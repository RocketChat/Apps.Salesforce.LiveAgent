## Availability Enpoint

  This endpoint can check whether or not the given Salesforce Live Agent Button Id(s) can accept the new chat requests.

|                                       Sample URL                                      |  Method  | Data Format |                    Data Params                    | Query Params |
|:-------------------------------------------------------------------------------------:|:--------:|:-----------:|:-------------------------------------------------:|:------------:|
| `http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/availability` | **GET** |   **NONE**  | **NONE** |   `button_ids` (Optional)   |

* **Sample Call:**

    **Curl**

    1. Without giving any specific Button Id. This will use the Button Id specified in the App setting.

      curl -X GET 'http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/availability'

    2. Giving a specific Button Id.

      curl -X GET 'http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/availability?button_ids=5732w000000U9T6'

    3. Giving multiple Button Ids.

      curl -X GET 'http://localhost:3000/api/apps/public/0d3ac5b3-dd0b-43d3-924a-5a7433902589/availability?button_ids=5732w000000U9T6,8732w000000U676'

* **Success Response of Button Id with Availability:**

  * **Code:** 200 <br />
    **Content:** 
    ```
    {
    "result": [
        {
            "estimatedWaitTime": 6,
            "id": "5732w000000U9T6",
            "isAvailable": true
        }
      ]
    }
    ```

* **Success Response of Button Id without any Availability:**

  * **Code:** 200 <br />
    **Content:** 
    ```
    {
    "result": [
        {
            "id": "5732w000000U9T6",
        }
      ]
    }
    ```





