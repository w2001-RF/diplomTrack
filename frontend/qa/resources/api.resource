*** Settings ***
Documentation       Test data setup through the Flask API, so UI tests start from a known state.
Library             RequestsLibrary
Resource            variables.resource


*** Keywords ***
Seed Test Data
    [Documentation]    Activates the seeded admin and creates one agent, one first-login agent
    ...                and one student. Expects the fresh database that run_qa.py prepares.
    Create Session    api    ${API_URL}    verify=${FALSE}
    ${admin_token}=    Log In Through API    ${ADMIN_EMAIL}    ${ADMIN_PASSWORD}
    # init_db.py creates the admin with must_reset_password=True
    Change Password Through API    ${admin_token}    ${ADMIN_PASSWORD}

    Create User Through API    ${admin_token}    qa.agent    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    AGENT
    ${agent_token}=    Log In Through API    ${AGENT_EMAIL}    ${AGENT_PASSWORD}
    Change Password Through API    ${agent_token}    ${AGENT_PASSWORD}

    Create User Through API    ${admin_token}    qa.newagent    ${NEW_AGENT_EMAIL}    ${NEW_AGENT_PASSWORD}    AGENT
    Create User Through API    ${admin_token}    qa.student    ${STUDENT_EMAIL}    ${STUDENT_PASSWORD}    STUDENT

Log In Through API
    [Arguments]    ${email}    ${password}
    ${body}=    Create Dictionary    email=${email}    password=${password}
    ${response}=    POST On Session    api    /auth/login    json=${body}    expected_status=200
    RETURN    ${response.json()}[access_token]

Change Password Through API
    [Arguments]    ${token}    ${password}
    ${headers}=    Create Dictionary    Authorization=Bearer ${token}
    ${body}=    Create Dictionary    password=${password}
    PUT On Session    api    /auth/reset-password    json=${body}    headers=${headers}    expected_status=200

Create User Through API
    [Arguments]    ${token}    ${username}    ${email}    ${password}    ${role}
    ${headers}=    Create Dictionary    Authorization=Bearer ${token}
    ${body}=    Create Dictionary    username=${username}    email=${email}    password=${password}    role=${role}
    POST On Session    api    /admin/users    json=${body}    headers=${headers}    expected_status=201
