./clean



# Artifact tools


./para inspect ../fixtures/pet-addendum.pdf

./para inspect ../fixtures/pet-addendum-bindings.pdf

./para validate ../fixtures/pet-addendum.yaml
./para validate ../fixtures/pet-addendum-md.yaml
./para validate ../fixtures/pet-addendum-docx.yaml
./para validate ../fixtures/pet-addendum-pdf.yaml
./para validate ../fixtures/pet-addendum-pdf-bindings.yaml


./para render ../fixtures/pet-addendum.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}'

./para render ../fixtures/pet-addendum.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' > ./temp.md

./para render ../fixtures/pet-addendum.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output-inline.md

./para render ../fixtures/pet-addendum-md.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output.md

./para render ../fixtures/pet-addendum-docx.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output.docx

./para render ../fixtures/pet-addendum-pdf.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output.pdf

./para render ../fixtures/pet-addendum-pdf-bindings.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --bindings ../fixtures/bindings.json --out ./output-bindings.pdf




# Data commands
para data template ../../fixtures/pet-addendum.yaml --out ./help.yaml
para data validate ../../fixtures/pet-addendum.yaml ./help.yaml
para data fill ../../fixtures/pet-addendum.yaml --out ./answers.yaml

# Artifact commands
para inspect ../../fixtures/pet-addendum.pdf

# Remote commands
para remote add origin https://github.com/paradoc-dev/pet-addendum
para remote view
para remote set-url origin https://github.com/paradoc-dev/pet-addendum
para remote rename origin old
para remote remove old

# Sync commands
para push origin
para push origin