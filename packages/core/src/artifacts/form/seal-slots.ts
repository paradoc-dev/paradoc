import type { Form, Layer, SignatureSlot, SigningField } from '@paradoc/types'

/**
 * Unified signature-slot planning for seal().
 *
 * A layer's `signatures` map declares every signing field once, with a
 * placement spec per slot. Planning turns those declarations into concrete
 * SigningFields (absolute placements) plus pending resolutions (anchor and
 * auto placements, resolved against the converted PDF by the placement
 * locator). Misconfiguration fails here, before any rendering, conversion,
 * or billing happens.
 */

/** Thrown before rendering when the seal configuration cannot succeed. */
export class SealConfigError extends Error {
	constructor(
		message: string,
		readonly problems: string[],
	) {
		super(message)
		this.name = 'SealConfigError'
	}
}

export interface AnchorResolution {
	field: SigningField
	text: string
	occurrence?: number
	offsetX: number
	offsetY: number
}

export interface SlotPlan {
	/** Fully resolved fields (absolute placements), in slot declaration order. */
	resolved: SigningField[]
	/** Fields awaiting anchor-text resolution against the converted PDF. */
	anchors: AnchorResolution[]
	/** Fields awaiting marker resolution ('auto' placement). */
	auto: SigningField[]
	/** Slots skipped because their party index is unfilled. */
	skipped: string[]
}

/** How a signature field's final position was determined. */
export type PlacementProvenance = 'declared' | 'anchor' | 'marker'

/**
 * Result of prepareSeal(): the signature map and the exact (un-flattened)
 * PDF it describes, without canonicalizing or changing the form's phase.
 */
export interface SealPreparation {
	/** Converted PDF the signature map's coordinates describe (pre-flatten). */
	pdf: Uint8Array
	signatureMap: SigningField[]
	/** Resolution source per field id. */
	provenance: Record<string, PlacementProvenance>
	warnings: string[]
}

interface PlanInput {
	formDef: Form
	slots: Record<string, SignatureSlot>
	partyValues: Record<string, unknown>
	signatoryValues: Record<string, Record<string, { signerId: string }[]>>
}

const partyArrayFor = (partyValues: Record<string, unknown>, role: string): unknown[] => {
	const parties = partyValues[role]
	return Array.isArray(parties) ? parties : parties ? [parties] : []
}

/**
 * Validate slot declarations and split them by resolution strategy.
 *
 * Fails loud on authoring errors (unknown roles, required-signature parties
 * with no slots, required slots without signatories). Skips slots whose
 * party index has no filled party: multi-party templates legitimately
 * declare more slots than a given fill uses.
 */
export function buildSlotPlan({ formDef, slots, partyValues, signatoryValues }: PlanInput): SlotPlan {
	const problems: string[] = []
	const definedRoles = new Set(Object.keys(formDef.parties ?? {}))

	for (const [slotId, slot] of Object.entries(slots)) {
		if (!definedRoles.has(slot.party.role)) {
			problems.push(`slot "${slotId}" references unknown party role "${slot.party.role}"`)
		}
	}

	// Fail-loud formality: a party whose signature is required but that no
	// slot places would produce an unsignable "sealed" document.
	for (const [role, party] of Object.entries(formDef.parties ?? {})) {
		const requiresSignature = (party as { signature?: { required?: boolean } }).signature?.required
		if (!requiresSignature) continue
		const hasSlot = Object.values(slots).some((slot) => slot.party.role === role)
		if (!hasSlot) problems.push(`party role "${role}" requires a signature but no slot places it on this layer`)
	}

	if (problems.length > 0) {
		throw new SealConfigError(
			`Cannot seal: ${problems.length} signature slot problem${problems.length === 1 ? '' : 's'}: ${problems.join('; ')}`,
			problems,
		)
	}

	// Signer bindings: "role:index" -> signerId, mirroring definition mode.
	const signerMap = new Map<string, string>()
	for (const [roleId, roleSignatories] of Object.entries(signatoryValues)) {
		const partyArray = partyArrayFor(partyValues, roleId)
		for (let index = 0; index < partyArray.length; index++) {
			const party = partyArray[index] as { id?: string }
			const partyId = party.id ?? `${roleId}-${index}`
			const partySignatories = roleSignatories[partyId] ?? []
			if (partySignatories.length > 0) {
				signerMap.set(`${roleId}:${index}`, partySignatories[0]!.signerId)
			}
		}
	}

	const plan: SlotPlan = { resolved: [], anchors: [], auto: [], skipped: [] }
	const missingSignatories: string[] = []
	let signerIndex = 0

	for (const [slotId, slot] of Object.entries(slots)) {
		const partyIndex = slot.party.index ?? 0
		const partyArray = partyArrayFor(partyValues, slot.party.role)
		// A slot for an unfilled party index is not an error: templates declare
		// slots for the maximum cardinality (e.g. up to four tenants).
		if (partyIndex >= partyArray.length) {
			plan.skipped.push(`slot "${slotId}" skipped: ${slot.party.role}[${partyIndex}] is not filled`)
			continue
		}

		const signerId = signerMap.get(`${slot.party.role}:${partyIndex}`)
		if (!signerId) {
			if (slot.required !== false) {
				missingSignatories.push(`slot "${slotId}" (${slot.party.role}[${partyIndex}]) has no signatory`)
			}
			continue
		}

		const base: SigningField = {
			id: slotId,
			signerIndex: signerIndex++,
			signerId,
			type: slot.type,
			page: 1,
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			...(slot.required !== undefined && { required: slot.required }),
			...(slot.label && { label: slot.label }),
		}

		if (slot.placement === 'auto') {
			plan.auto.push(base)
		} else if ('anchor' in slot.placement) {
			plan.anchors.push({
				field: {
					...base,
					width: slot.placement.width,
					height: slot.placement.height,
					anchor: {
						text: slot.placement.anchor.text,
						offsetX: slot.placement.anchor.offsetX ?? 0,
						offsetY: slot.placement.anchor.offsetY ?? 0,
					},
				},
				text: slot.placement.anchor.text,
				occurrence: slot.placement.anchor.occurrence,
				offsetX: slot.placement.anchor.offsetX ?? 0,
				offsetY: slot.placement.anchor.offsetY ?? 0,
			})
		} else {
			plan.resolved.push({
				...base,
				page: slot.placement.page,
				x: slot.placement.x,
				y: slot.placement.y,
				width: slot.placement.width,
				height: slot.placement.height,
			})
		}
	}

	if (missingSignatories.length > 0) {
		throw new SealConfigError(
			`Cannot seal: ${missingSignatories.length} required slot${missingSignatories.length === 1 ? '' : 's'} without signatories: ${missingSignatories.join('; ')}`,
			missingSignatories,
		)
	}

	if (plan.resolved.length + plan.anchors.length + plan.auto.length === 0) {
		throw new SealConfigError(
			'Cannot seal: no signature slots could be mapped to signatories. Ensure parties have signatories assigned.',
			['no mappable slots'],
		)
	}

	return plan
}

/** True when the layer declares unified signature slots. */
export function hasSignatureSlots(layer: Layer | undefined): layer is Layer & { signatures: Record<string, SignatureSlot> } {
	return Boolean(layer?.signatures && Object.keys(layer.signatures).length > 0)
}
