*** Settings ***
Documentation       Login form, error handling and logout.
Resource            ../resources/app.resource
Suite Setup         Open App
Suite Teardown      Close All Browsers
Test Setup          Go To Login Page
Test Tags           auth


*** Test Cases ***
Login Page Shows Both Tabs
    Page Should Contain    DiplomTrack
    Page Should Contain Element    xpath://button[@role="tab" and normalize-space()="Connexion"]
    Page Should Contain Element    xpath://button[@role="tab" and normalize-space()="Inscription"]

Wrong Password Shows The Backend Error
    [Tags]    smoke
    Submit Login Form    ${AGENT_EMAIL}    wrong-password
    Toast Should Show    Invalid credentials
    Location Should Be    ${BASE_URL}/auth

Invalid Input Is Rejected Before Calling The API
    Submit Login Form    a@b    123
    Wait Until Page Contains    Email invalide
    Page Should Contain    Le mot de passe doit contenir au moins 6 caractères

Agent Can Log In And Out
    [Tags]    smoke
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    Toast Should Show    Connexion réussie
    Log Out
    ${token}=    Execute JavaScript    return window.localStorage.getItem('auth_token')
    Should Be Equal    ${token}    ${NONE}

Session Survives A Page Reload
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    Reload Page
    Location Should Eventually Be    /agent
    Wait Until Element Is Visible    ${LOGOUT_BUTTON}

Tampered Token Sends The User Back To Login
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    Execute JavaScript    window.localStorage.setItem('auth_token', 'tampered')
    Reload Page
    Location Should Eventually Be    /auth
