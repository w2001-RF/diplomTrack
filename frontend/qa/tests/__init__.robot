*** Settings ***
Documentation       DiplomTrack end-to-end QA suite. Run it with qa/run_qa.py, which
...                 starts a throwaway backend and the SPA; see qa/README.md.
Resource            ../resources/api.resource
Resource            ../resources/app.resource
Suite Setup         Seed Test Data
