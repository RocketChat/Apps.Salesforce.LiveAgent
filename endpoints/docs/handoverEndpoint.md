## Handover Enpoint

  This endpoint can perform handover of a current ongoing Live Chat session to the given Omnichannel department.

|                                       Sample URL                                      |  Method  | Data Format |                    Data Params                    | Query Params |
|:-------------------------------------------------------------------------------------:|:--------:|:-----------:|:-------------------------------------------------:|:------------:|
| `http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/handover` | **POST** |   **JSON**  | `roomId` & `targetDepartmentName` (Both Required) |   **NONE**   |

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

* **Active Live Agent Session Error Response:**

  * **Code:** 406 NOT ACCEPTABLE <br />
    **Content:** <br/>
    `{
        result: "Cannot perform handover amidst an active Liveagent session."
    }`



