import { para } from "@/index";

const myForm = para
  .form()
  .name("pet-addendum")
  .title("Pet Addendum")
  .code("PET-123")
  .releaseDate("2025-01-01")
  .description("This is a simple pet addendum.")
  .fields({
    name: para.field
      .text()
      .label("Name")
      .description("The name of the pet")
      .minLength(1)
      .maxLength(100)
      .required(true)
      .build(),
    type: para.field
      .enum()
      .options([{ value: "dog" }, { value: "cat" }, { value: "bird" }, { value: "turtle" }])
      .label("Species")
      .description("The species of the pet")
      .required(true)
      .build(),
    age: para.field
      .number()
      .label("Age")
      .description("The age of the pet")
      .required(false)
      .min(0)
      .max(100)
      .build(),
  })
  .inlineLayer('default', { mimeType: 'text/plain', text: `The pet is a {{name}} of type {{type}} and is {{age}} years old.` })
  .defaultLayer('default')
  .build();

console.log(myForm);
