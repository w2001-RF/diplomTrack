*** Settings ***
Documentation       Browser keywords for the DiplomTrack SPA (SeleniumLibrary).
# variables.resource first: the library import reads ${TIMEOUT}
Resource            variables.resource
# implicit_wait: every element lookup waits for the SPA to render it
Library             SeleniumLibrary    timeout=${TIMEOUT}    implicit_wait=5s    run_on_failure=Capture Page Screenshot


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

Change Milestone To
    [Documentation]    Picks a milestone in the dossier page's "Changer le jalon" select.
    [Arguments]    ${label}
    Wait Until Element Is Enabled    css:button[role="combobox"]
    Click Element    css:button[role="combobox"]
    Wait Until Element Is Visible    xpath://div[@role="option" and normalize-space()="${label}"]
    Click Element    xpath://div[@role="option" and normalize-space()="${label}"]

Current Milestone Should Be
    [Arguments]    ${label}
    Wait Until Element Contains    css:button[role="combobox"]    ${label}

Upload Document File
    [Documentation]    Uploads a scanned file for one document through the dossier page's dialog.
    [Arguments]    ${document_type}    ${path}=${SCAN_FILE}
    Click Button    css:button[aria-label="Téléverser ${document_type}"]
    Wait Until Element Is Visible    xpath://div[@role="dialog"]
    Choose File    id:document-file    ${path}
    Click Button    xpath://div[@role="dialog"]//button[normalize-space()="Téléverser"]
    Wait Until Element Is Not Visible    xpath://div[@role="dialog"]
    Wait Until Page Contains Element    css:button[aria-label="Voir ${document_type}"]

Validate Every Pending Document
    [Documentation]    Clicks "Valider" on each document until none is left, confirming each dialog.
    ${remaining}=    Get Element Count    xpath://button[normalize-space()="Valider"]
    WHILE    ${remaining} > 0    limit=20
        Click Button    xpath:(//button[normalize-space()="Valider"])[1]
        Click Button    xpath://div[@role="dialog"]//button[contains(., "Confirmer la validation")]
        Wait Until Element Is Not Visible    xpath://div[@role="dialog"]
        Wait Until Keyword Succeeds    5s    0.25s    Valider Count Should Drop Below    ${remaining}
        ${remaining}=    Get Element Count    xpath://button[normalize-space()="Valider"]
    END

Valider Count Should Drop Below
    [Arguments]    ${count}
    ${now}=    Get Element Count    xpath://button[normalize-space()="Valider"]
    Should Be True    ${now} < ${count}
