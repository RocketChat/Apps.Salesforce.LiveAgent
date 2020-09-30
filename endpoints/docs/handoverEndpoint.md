## Handover Enpoint

  This endpoint can perform handover of a current ongoing Live Chat session to the given Omnichannel department.

|                                       Sample URL                                      |  Method  | Data Format |        Required Data Params       | Optional Data Params | Query Params |
|:-------------------------------------------------------------------------------------:|:--------:|:-----------:|:---------------------------------:|:--------------------:|:------------:|
| `http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/handover` | **POST** |   **JSON**  | `roomId` & `targetDepartmentName` |      `buttonId`      |   **NONE**   |

* **Params Description:**

|       Param Name       |                                                                                                                             Description                                                                                                                            |
|:----------------------:|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------:|
|        `roomId`        |                                                                                                        The Id of the room you want to perform handover from.                                                                                                       |
| `targetDepartmentName` |                                                                                                     The name of the department you want to perform handover to.                                                                                                    |
|       `buttonId`       | The Salesforce Live Agent Button Id to route the handed-off chat to, instead of the one configured in the app settings. |

* **Sample Call:**

    **Curl**
    ```bash
      curl -H "Content-type:application/json" \
      http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/handover \
      -d '{ "roomId": "uz7dyhqax2LNfaQBo", "targetDepartmentName": "salesforce" }'
    ```

* **Success Response:**

  * **Code:** 200 <br />
    **Content:** `{ result: "Handover request completed successfully" }`

* **Error Response (Active Live Agent Session):**

  * **Code:** 406 NOT ACCEPTABLE <br />
    **Content:** <br/>
    `{
        result: "Cannot perform handover amidst an active Liveagent session."
    }`



