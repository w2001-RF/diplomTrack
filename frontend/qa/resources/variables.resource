*** Settings ***
Documentation       Shared settings. run_qa.py overrides BASE_URL, API_URL, BROWSER,
...                 HEADLESS and ADMIN_PASSWORD with --variable.


*** Variables ***
${BASE_URL}             http://localhost:8095
${API_URL}              http://localhost:5055/api
${BROWSER}              chrome
${HEADLESS}             ${TRUE}
${TIMEOUT}              10s

# Accounts created by the Seed Test Data keyword (api.resource)
${ADMIN_EMAIL}          admin@uit.ac.ma
${ADMIN_PASSWORD}       QaAdmin-2026!
${AGENT_EMAIL}          qa.agent@uit.ac.ma
${AGENT_PASSWORD}       QaAgent-2026!
# Created with must_reset_password=True to exercise the forced reset
${NEW_AGENT_EMAIL}      qa.newagent@uit.ac.ma
${NEW_AGENT_PASSWORD}   QaTemp-2026!
${STUDENT_EMAIL}        qa.student@uit.ac.ma
${STUDENT_PASSWORD}     QaStudent-2026!
