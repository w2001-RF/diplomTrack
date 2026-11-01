*** Settings ***
Documentation       A dossier from creation to closure: the agent creates it, moves it through
...                 every milestone of the main path, validates the documents, and the student
...                 follows it from their own account. The tests run in order on one dossier.
Resource            ../resources/app.resource
Resource            ../resources/api.resource
Suite Setup         Open App
Suite Teardown      Close All Browsers
Test Tags           lifecycle


*** Variables ***
${STUDENT_FULL_NAME}    ${LIFECYCLE_FIRST_NAME} ${LIFECYCLE_LAST_NAME}


*** Test Cases ***
Agent Creates A Dossier For A Student
    Log In As    ${AGENT_EMAIL}    ${AGENT_PASSWORD}    /agent
    Open Page    /dossiers/create
    Input Text    css:input[placeholder^="Rechercher par nom"]    ${LIFECYCLE_LAST_NAME}
    Click Element    xpath://*[normalize-space()="${STUDENT_FULL_NAME}"]
    Click Button    xpath://button[contains(., "Créer le ticket")]
    Wait Until Location Contains    /dossier/
    ${url}=    Get Location
    VAR    ${TICKET_URL}    ${url}    scope=SUITE
    VAR    ${TICKET_ID}    ${url.rsplit('/', 1)[-1]}    scope=SUITE
    Current Milestone Should Be    Créé
    Page Should Contain    ${LIFECYCLE_LAST_NAME}

Agent Starts Processing The Dossier
    Go To    ${TICKET_URL}
    Change Milestone To    Dossier en cours
    Current Milestone Should Be    Dossier en cours

Dossier Cannot Be Complete Before Its Documents
    Go To    ${TICKET_URL}
    Change Milestone To    Pièces complètes
    Toast Should Show    Missing or unvalidated documents
    Reload Page
    Current Milestone Should Be    Dossier en cours

Agent Uploads The Scanned Documents
    @{missing}=    Missing Documents Through API    ${TICKET_ID}
    Should Not Be Empty    ${missing}
    Go To    ${TICKET_URL}
    FOR    ${document_type}    IN    @{missing}
        Upload Document File    ${document_type}
    END
    # Files are stored under a generated name: ticket_<id>_<type>_<random>.pdf
    Page Should Contain    ticket_${TICKET_ID}_

Agent Validates The Scanned Documents
    Go To    ${TICKET_URL}
    Wait Until Page Contains Element    xpath://button[normalize-space()="Valider"]
    Validate Every Pending Document
    Page Should Not Contain Element    xpath://button[normalize-space()="Valider"]

Agent Moves The Dossier To Closure
    Go To    ${TICKET_URL}
    FOR    ${milestone}    IN    Pièces complètes    En attente de réponse    Réponse reçue    Dossier clôturé
        Change Milestone To    ${milestone}
        Current Milestone Should Be    ${milestone}
    END
    Reload Page
    Current Milestone Should Be    Dossier clôturé

Closed Dossier Shows In The Agent's List
    Open Page    /dossiers
    Wait Until Page Contains    ${STUDENT_FULL_NAME}
    ${row}=    Set Variable    xpath://*[contains(., "${LIFECYCLE_LAST_NAME}") and contains(., "Dossier clôturé")]
    Page Should Contain Element    ${row}

Student Follows The Dossier From Their Account
    Log In As    ${STUDENT_EMAIL}    ${STUDENT_PASSWORD}    /my-dossier
    Wait Until Page Contains    Dossier clôturé
    Click Button    ${NOTIFICATIONS_BELL}
    Wait Until Element Is Visible    css:[role="menu"]
    Element Should Contain    css:[role="menu"]    Dossier complet
