./clean



# Artifact tools


./paradoc inspect ../fixtures/pet-addendum.pdf

./paradoc inspect ../fixtures/pet-addendum-bindings.pdf

./paradoc validate ../fixtures/pet-addendum.yaml
./paradoc validate ../fixtures/pet-addendum-md.yaml
./paradoc validate ../fixtures/pet-addendum-docx.yaml
./paradoc validate ../fixtures/pet-addendum-pdf.yaml
./paradoc validate ../fixtures/pet-addendum-pdf-bindings.yaml


./paradoc render ../fixtures/pet-addendum.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}'

./paradoc render ../fixtures/pet-addendum.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' > ./temp.md

./paradoc render ../fixtures/pet-addendum.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output-inline.md

./paradoc render ../fixtures/pet-addendum-md.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output.md

./paradoc render ../fixtures/pet-addendum-docx.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output.docx

./paradoc render ../fixtures/pet-addendum-pdf.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --out ./output.pdf

./paradoc render ../fixtures/pet-addendum-pdf-bindings.yaml --data '{"name":"Fluffy","species":"cat","weight":3,"hasVaccination":true}' --bindings ../fixtures/bindings.json --out ./output-bindings.pdf




# Data commands
paradoc data template ../../fixtures/pet-addendum.yaml --out ./help.yaml
paradoc data validate ../../fixtures/pet-addendum.yaml ./help.yaml
paradoc data fill ../../fixtures/pet-addendum.yaml --out ./answers.yaml

# Artifact commands
paradoc inspect ../../fixtures/pet-addendum.pdf

# Remote commands
paradoc remote add origin https://github.com/paradoc-dev/pet-addendum
paradoc remote view
paradoc remote set-url origin https://github.com/paradoc-dev/pet-addendum
paradoc remote rename origin old
paradoc remote remove old

# Sync commands
paradoc push origin
paradoc push origin