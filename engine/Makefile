.PHONY: install verify run medical
install:
	bash scripts/bootstrap.sh
verify:
	bash scripts/verify.sh
run:
	uvicorn main:app --host 127.0.0.1 --port 8110
medical:
	bash scripts/llama-medical.sh
