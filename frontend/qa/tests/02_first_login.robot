*** Settings ***
Documentation       Accounts created by an admin must change their password at first login.
Resource            ../resources/app.resource
Suite Setup         Open App
Suite Teardown      Close All Browsers
Test Tags           auth    first-login


*** Variables ***
${CHOSEN_PASSWORD}      QaChosen-2026!


*** Test Cases ***
New Agent Is Forced To Change Their Password
    [Documentation]    Runs once per fresh database: it consumes the first-login state.
    Go To Login Page
    Submit Login Form    ${NEW_AGENT_EMAIL}    ${NEW_AGENT_PASSWORD}
    Wait Until Page Contains    Réinitialisation obligatoire
    Input Password    id:newPassword    ${CHOSEN_PASSWORD}
    Input Password    id:confirmPassword    ${CHOSEN_PASSWORD}
    Click Button    xpath://div[@role="dialog"]//button[contains(., "Réinitialiser et continuer")]
    # The modal sits on top of /agent, so wait for it to close rather than for the URL
    Wait Until Page Does Not Contain    Réinitialisation obligatoire
    Location Should Eventually Be    /agent

The Chosen Password Works On The Next Login
    Log In As    ${NEW_AGENT_EMAIL}    ${CHOSEN_PASSWORD}    /agent
    Page Should Not Contain    Réinitialisation obligatoire

The Temporary Password No Longer Works
    Go To Login Page
    Submit Login Form    ${NEW_AGENT_EMAIL}    ${NEW_AGENT_PASSWORD}
    Toast Should Show    Invalid credentials
