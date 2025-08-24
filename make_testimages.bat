@echo off
if NOT exist .venv\ (
	python -m venv .venv
)
.venv\Scripts\python.exe -m pip install pillow
.venv\Scripts\python.exe make_testimages.py

