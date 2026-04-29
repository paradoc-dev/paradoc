import { para, toYAML } from '@/index'

const myForm = para.form({
  kind: 'form',
  version: '1.0.0',
  name: 'pet-addendum',
  title: 'Pet Addendum',
  code: 'PET-123',
  releaseDate: '2025-01-01',
  description: 'This is a simple pet addendum.',
  fields: {
    name: {
      type: 'text',
      label: 'Name',
      description: 'The name of the pet',
      minLength: 1,
      maxLength: 100,
      required: true,
    },
    type: {
      type: 'enum',
      label: 'Species',
      description: 'The species of the pet',
      enum: ['dog', 'cat', 'bird', 'turtle'],
      required: true,
    },
    age: {
      type: 'number',
      label: 'Age',
      description: 'The age of the pet',
      required: false,
      min: 0,
      max: 100,
    },
  },
  layers: {
    default: {
      kind: 'inline',
      mimeType: 'text/plain',
      text: `The pet is a {{name}} of type {{type}} and is {{age}} years old.`,
    },
  },
  defaultLayer: 'default',
  annexes: {},
})

console.log(myForm)

// Validate artifact definition (using instance method)
const isValidArtifact = myForm.validate()
console.log(isValidArtifact)

// Create sample data for validation
const sampleData = {
  fields: {
    name: 'Fluffy',
    type: 'cat',
    age: 3,
  },
}
console.log('ℹ️ sampleData')
console.log(sampleData)

// Serialize (using direct exports)
const yaml = toYAML(sampleData)
console.log(yaml)

const json = JSON.stringify(sampleData, null, 2)
console.log(json)

// Validate data against form (using instance method)
const isValid = myForm.safeParseData(sampleData)
console.log(isValid)
