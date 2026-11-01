*** Settings ***
Documentation       Each role lands on its own home page and is kept out of the others.
Resource            ../resources/app.resource
Suite Setup         Open App
Suite Teardown      Close All Browsers
Test Tags           access-control


*** Test Cases ***
Anonymous Visitor Is Sent To Login
    [Tags]    smoke
    [Template]    Anonymous Visit Should Redirect To Login
    /dossiers
    /admin
    /my-dossier
    /settings

Each Role Lands On Its Home Page
    [Tags]    smoke
    [Template]    Login Should Land On
    ${ADMIN_EMAIL}      ${ADMIN_PASSWORD}      /admin
    ${AGENT_EMAIL}      ${AGENT_PASSWORD}      /agent
    ${STUDENT_EMAIL}    ${STUDENT_PASSWORD}    /my-dossier

Student Is Kept Out Of Staff Pages
    Log In As    ${STUDENT_EMAIL}    ${STUDENT_PASSWORD}    /my-dossier
    FOR    ${path}    IN    /dossiers    /students    /users    /settings
        Open Page    ${path}
        Location Should Eventually Be    /my-dossier
    END

Agent Is Kept Out Of Admin Pages
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    FOR    ${path}    IN    /users    /settings    /admin
        Open Page    ${path}
        # ProtectedRoute sends agents to "/", which RootRedirect resolves to /agent
        Location Should Eventually Be    /agent
    END

Agent Can Open Staff Pages
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    FOR    ${path}    IN    /dossiers    /students    /agent-notifications
        Open Page    ${path}
        Location Should Eventually Be    ${path}
    END

Agent Sees Records Created Through The API
    [Documentation]    Collection URLs without a trailing slash used to answer 308; the
    ...                browser followed it cross-origin without the token and the list stayed empty.
    [Tags]    smoke    lists
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    Open Page    /students
    Wait Until Page Contains    ${LISTED_STUDENT_LAST_NAME}

Unknown Page Shows Not Found
    Open Page    /this-page-does-not-exist
    Wait Until Page Contains    Page not found


*** Keywords ***
Anonymous Visit Should Redirect To Login
    [Arguments]    ${path}
    Go To Login Page
    Open Page    ${path}
    Location Should Eventually Be    /auth

Login Should Land On
    [Arguments]    ${email}    ${password}    ${home}
    Log In As    ${email}    ${password}    ${home}
