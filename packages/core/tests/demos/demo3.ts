import { para, type Form, type InferFormData, type InferFormPayload, type NumberField } from '@/index'

const f0: Form = {
  kind: 'form',
  version: '1.0.0',
  name: 'pet-adoption',
  title: 'Pet Adoption Form',
  description: 'Collect details from prospective adopters',
  code: 'FORM-ADOPT-1',
  defs: {
    isAdult: { type: 'boolean', value: 'fields.age >= 18' },
  },
  metadata: {
    department: 'adoptions',
    revision: 5,
  },
  fields: {
    age: {
      type: 'number',
      label: 'Age',
      description: 'The age of the pet',
      required: true,
      min: 0,
      max: 100,
    } as NumberField,
  },
}
console.log(f0)

const f1 = para.form({
  version: '1.0.0',
  name: 'pet-adoption',
  title: 'Pet Adoption Form',
  defs: {
    isAdult: { type: 'boolean', value: 'fields.age >= 18' },
  },
  fields: {
    age: {
      type: 'number',
      label: 'Age',
      description: 'The age of the pet',
      required: true,
      min: 0,
      max: 100,
    },
    isSmoker: {
      type: 'boolean',
      label: 'Is Smoker',
      description: 'Whether the pet is a smoker',
      required: false,
      // required: 'isAdult',
    },
  },
  layers: {
    default: {
      kind: 'inline',
      mimeType: 'text/markdown',
      text: `The pet owner is {{age}} years old and {{isSmoker ? 'is a smoker' : 'is not a smoker'}}.`,
    },
  },
  defaultLayer: 'default',
})
console.log(f1)

const f3 = para
  .form()
  .name('pet-adoption')
  .version('1.0.0')
  .title('Pet Adoption Form')
  .defs({
    isAdult: { type: 'boolean', value: 'fields.age >= 18' },
  })
  .fields({
    age: para.field
      .number()
      .label('Age')
      .description('The age of the pet')
      .required(true)
      .min(0)
      .max(100),
  })
  .build()
console.log(f3)

console.log('Validating form...')
const isValid = f1.validate()
console.log(isValid)

type DataPayload = InferFormData<typeof f1>
type Payload = InferFormPayload<typeof f1>

const data: DataPayload = {
  fields: {
    age: 21,
    // isSmoker: false,
  },
}

const payload: Payload = {
  fields: {
    age: -1,
    // isSmoker: false, // type will be boolean | undefined because 'isAdult' known only at runtime
  },
}

const isValidData = f1.safeParseData(data)
console.log(isValidData)

const isValidPayload = f1.safeParseData(payload)
console.log(isValidPayload)
