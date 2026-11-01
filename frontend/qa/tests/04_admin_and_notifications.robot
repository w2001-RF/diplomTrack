*** Settings ***
Documentation       Admin user list and the notification menu, against the real API.
Resource            ../resources/app.resource
Suite Setup         Open App
Suite Teardown      Close All Browsers
Test Tags           admin


*** Test Cases ***
Admin Sees Seeded Users With Their Roles
    Log In As    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}    /admin
    Open Page    /users
    Wait Until Page Contains    ${AGENT_EMAIL}
    ${row}=    Set Variable    xpath://tr[td[contains(., "${AGENT_EMAIL}")]]
    # Role badges used lowercase keys before the refactor and rendered empty
    Element Should Contain    ${row}    Agent BFC
    Page Should Contain    ${STUDENT_EMAIL}

Admin Can Search Users
    Log In As    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}    /admin
    Open Page    /users
    Wait Until Page Contains    ${AGENT_EMAIL}
    Input Text    css:input[placeholder="Rechercher par nom ou email..."]    qa.student
    Wait Until Page Does Not Contain    ${AGENT_EMAIL}
    Page Should Contain    ${STUDENT_EMAIL}

Notification Menu Opens With An Empty State
    [Tags]    notifications
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    Click Button    ${NOTIFICATIONS_BELL}
    Wait Until Element Is Visible    css:[role="menu"]
    Element Should Contain    css:[role="menu"]    Aucune notification
