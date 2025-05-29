# Delete account story

When checking the text in e2e, always use the data-testid!

## Sign-In Process

| ID  | User Story                                      | Expected Behavior                                                                                                                                                                                                                                 | Validation Rules                                                                                          |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | User should be able to delete account           | When user goes to profile page, scroll down, and then click on the dialog, user then enters the correct password and DELETE, should be redirected to the /login page. After deletion complete, user cannot login using the old email and password | User sees dialog showing when clicking on the delete account button. After deletion, user sees login page |
| 2   | User enters wrong password for account deletion | When user goes to profile page, clicks delete account button, enters incorrect password or wrong confirmation word (not "DELETE"), user sees error message and after page refresh, should still be logged in                                      | User sees error message for incorrect password/confirmation. After refresh, user remains authenticated    |
| 3   | User closes delete account dialog               | When user goes to profile page, clicks delete account button but closes the dialog without completing deletion, user should still be logged in                                                                                                    | User remains on profile page and stays authenticated after closing dialog                                 |
