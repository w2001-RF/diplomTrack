*** Settings ***
Documentation       Browser keywords for the DiplomTrack SPA (SeleniumLibrary).
# variables.resource first: the library import reads ${TIMEOUT}
Resource            variables.resource
Library             SeleniumLibrary    timeout=${TIMEOUT}    run_on_failure=Capture Page Screenshot


*** Variables ***
${LOGIN_EMAIL}          id:login-email
${LOGIN_PASSWORD}       id:login-password
${LOGIN_BUTTON}         xpath://button[@type="submit" and contains(., "Se connecter")]
${LOGOUT_BUTTON}        xpath://button[contains(., "Déconnexion")]
${NOTIFICATIONS_BELL}   css:button[aria-label="Notifications"]


*** Keywords ***
Open App
    [Documentation]    Opens ${BROWSER} (chrome, edge or firefox) on the login page.
    ${options}=    Set Variable If    ${HEADLESS}    add_argument("--headless=new")    ${NONE}
    Open Browser    ${BASE_URL}/auth    ${BROWSER}    options=${options}
    Set Window Size    1440    900
    Wait Until Element Is Visible    ${LOGIN_EMAIL}

Go To Login Page
    Go To    ${BASE_URL}/auth
    # Start every test signed out: the JWT lives in localStorage
    Execute JavaScript    window.localStorage.clear()
    Reload Page
    Wait Until Element Is Visible    ${LOGIN_EMAIL}

Submit Login Form
    [Arguments]    ${email}    ${password}
    Input Text    ${LOGIN_EMAIL}    ${email}
    Input Password    ${LOGIN_PASSWORD}    ${password}
    Click Button    ${LOGIN_BUTTON}

Log In As
    [Documentation]    Logs in from a clean session and waits for the role's home page.
    [Arguments]    ${email}    ${password}    ${home}
    Go To Login Page
    Submit Login Form    ${email}    ${password}
    Location Should Eventually Be    ${home}

Log Out
    Click Button    ${LOGOUT_BUTTON}
    Location Should Eventually Be    /auth

Location Should Eventually Be
    [Arguments]    ${path}
    Wait Until Location Is    ${BASE_URL}${path}

Open Page
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}

Toast Should Show
    [Arguments]    ${text}
    Wait Until Element Is Visible    xpath://li[@data-sonner-toast and contains(., "${text}")]
