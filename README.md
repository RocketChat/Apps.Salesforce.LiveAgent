# Salesforce Live Agent Integration App

<p align="center">

<img  src="https://user-images.githubusercontent.com/41849970/88838683-895e3000-d1f7-11ea-8d5d-1a3e1d82b30d.png">

</p>

Integration between Rocket.Chat and the Salesforce Live Agent (Chat).

---

## Index
- [Salesforce Live Agent Integration App](#salesforce-live-agent-integration-app)
	- [Index](#index)
	- [Prerequisites](#prerequisites)
	- [App Installation](#app-installation)
	- [App Configuration](#app-configuration)
		- [Required App Settings](#required-app-settings)
		- [Dialogflow Chatbot Configurations (Optional)](#dialogflow-chatbot-configurations-optional)
	- [App Usage](#app-usage)
		- [Standalone App Usage](#standalone-app-usage)
		- [Dialogflow Chatbot App Usage](#dialogflow-chatbot-app-usage)
	- [REST API Endpoints](#rest-api-endpoints)
- [Some Optional App Configurations](#some-optional-app-configurations)
	- [Setting a default welcome message (Auto Greeting)](#setting-a-default-welcome-message-auto-greeting)
	- [Customising app responses](#customising-app-responses)
	- [Debug Mode](#debug-mode)
	- [Setting a default Omnichannel department](#setting-a-default-omnichannel-department)

---

## Prerequisites

1. Salesforce Org with Live Agent Setup.

2. Rocket Chat Instance with Live Chat Setup.

   - Rocket Chat >= v3.6.0
   - Rocket Chat setup guide [here.](https://docs.rocket.chat/guides/developer/quick-start)
   - Live Chat [guide](https://docs.rocket.chat/guides/administrator-guides/livechat#:~:text=Enable%20Livechat%20feature,Settings%20%3E%20Livechat%20and%20enable%20it.&text=Now%20the%20admin%20will%20have,left%20corner%20drop%20down%20menu.) and [repo](https://github.com/RocketChat/Rocket.Chat.Livechat)

3. Rocket.Chat App Engine CLI.
   - Guide [here](https://docs.rocket.chat/apps-development/getting-started#rocket-chat-app-engine-cli)

---

## App Installation

To install the app, just go to the Rocket.Chat Marketplace in your server from **Administration** -> **Marketplace** and search for the app. You will find an **Install** button, clicking on it will install the app in your server in no time. If you are a developer or want to modify the app/ contribute to the app, you can follow these instructions to deploy app manually on your Rocket.Chat instance:

1. Clone this repository

   `git clone https://github.com/WideChat/Apps.Salesforce.LiveAgent`

1. Change to root directory

   `cd Apps.Salesforce.LiveAgent`

1. Install NPM Packages

   `npm install`

1. Deploy to your Rocket Chat Server

   `rc-apps deploy --url <YOUR SERVER URL> --username <YOUR ADMIN USERNAME> --password <YOUR ADMIN PASSWORD>`

1. In your Rocket Chat Server, you can now go to **Administration** -> **Apps** and access the app from there.

---

## App Configuration

### Required App Settings

1. **Salesforce Bot Username** and **Salesforce Bot Department Name**

   - Create a new user from **Administration** -> **Users**. Fill out all the details as you want, after filling all the details add, `bot` and `livechat-agent` to the **Roles** at the end of the form and hit **Save**. Paste this user's username in respective field on app setting page.

   - Then go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our new bot user to that deparment. Paste this department name in **Salesforce Bot Department Name** setting field. **Note:** Make sure to never add any other user other than the one we just added in this department.

1. **Salesforce Chat Endpoint**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for chat setting -> Click on Chat Settings option -> Copy Chat API Endpoint value.

1. **Salesforce Organization ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for company information -> Click on Company Information option -> Copy Salesforce.com Organization ID value.

1. **Salesforce Deployment ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of deploymentId from Chat Code Snippet.

1. **Salesforce Button ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of buttonId from Chat Code Snippet.

Adding the above values to the app settings page is all you need to do to get Liveagent talking to your Livechat visitors. You can now proceed to [App Usage](#app-usage) section to know how to actually use this app. However this app is also designed to work with Dialogflow, so that you can include a Dialogflow Chatbot alongside your Liveagent. Please keep reading to know more about Dialogflow Chatbot Configurations.

### Dialogflow Chatbot Configurations (Optional)

1. To configure the Dialogflow Chatbot, you will need to install [Dialogflow App](https://github.com/WideChat/Apps.Dialogflow#appsdialogflow), available for free from the Rocket.Chat Marketplace. You can refer to the setup guide [here](https://github.com/WideChat/Apps.Dialogflow#how-to-get-google-credential-file-or-private-key-file), for setup instructions.

2. Once you have the Dialogflow app completely setup and running on your Rocket.Chat instance. Paste the Dialogflow Bot User username and department name in **Dialogflow Bot Username** and **Dialogflow Bot Department Name** fields respectively on Salesforce Liveagent Integration app settings page.

3. Now you can provide your visitors with a **Handover** button, this button will enable visitors to perform a handover to Liveagent. To add this button in your Dialogflow response, just add the [Handover Button Block](https://github.com/WideChat/Apps.Dialogflow/blob/master/docs/QuickReplies.md#handover-button) block in your **Quick replies** Payload. Once you have this block added in your Quick replied payload, go to the Dialogflow app settings and paste the Salesforce Bot Department name in **Target Department for Handover** field.

4. Awesome! You have now Dialogflow Chatbot and Salesforce Liveagent working alongside each other. You can even take it a step further by providing a **End Chat Event**. This is an event that is triggered automatically when the chat is ended with Salesforce Liveagent and the visitor is handed back to Dialogflow.

5. To enable the **End Chat Event**, just go to your **Salesforce Liveagent app settings** -> Toggle the **Enable Dialogflow End Chat Event (Optional)** setting to **ON**. This will enable the **End Chat Event**.

6. Now provide the name of the [Dialogflow event](https://cloud.google.com/dialogflow/es/docs/events-overview) in the **Dialogflow End Chat Event Name (Optional)** of the Salesforce Liveagent app settings. For example if your Dialogflow event name is `end_live_chat`, then provide that name in the setting field.

7. If your Dialogflow event is using language other than **English**, then provide a language code in **Dialogflow End Chat Event Language Code (Optional)**. By default it is set to `en`.

8. Following are the instructions on how to use the app:

---

## App Usage

App should be running right away once you complete all required above configurations. However before making a new Chat request, make sure your Salesforce Live Agent is **Online**:

   - To change your Live Agent status to online, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> On the right hand side, you will find an icon named **App Launcher** (<img width="32" alt="Screenshot 2020-07-08 at 9 03 50 PM" src="https://user-images.githubusercontent.com/41849970/86938913-9939a580-c15e-11ea-8544-9aefab50555b.png">) -> Click on this icon and go to **Service Console**.

   - Once you are in Service Console, look at the bottom bar. From the bottom bar, click on **Omni-channel** and change status from `Offline` to `Available - Chat`.

Once your Live Agent is online and ready to take new requests. Go to your Rocket Chat Live Chat widget to initiate a session. Now you can initiate a new session in either of the two ways, based on how you setup your app:

### Standalone App Usage

In this type, a new chat session will be automatically initiated once your visitor enters the **Salesforce Bot Department** of Rocket.Chat Livechat. Refers to following steps for more info:

![Standalone Usage Steps](https://user-images.githubusercontent.com/41849970/92993133-2b6a7b00-f50d-11ea-87a0-644075387f19.png)

### Dialogflow Chatbot App Usage

In this type, the visitor will enter the **Dialogflow Bot department** and will be provided with a **Handover Button** as per your configured settings. For example: If you have set your "Quick replies payload with Handover button" in **Default Fallback Intent**, Dialogflow Bot will provide the handover option to visitor, whenever the Dialogflow is unsure of the user question:

![Chatbot Usage Steps](https://user-images.githubusercontent.com/41849970/92993416-f7905500-f50e-11ea-9bf3-8bc31cfb020a.png)

---

## REST API Endpoints

REST API Endpoints can be used to trigger specific actions in the app. You can go to the app setting page and get the complete URLs to make an API call using `cURL` or any other software of your choice, for example [Postman](https://www.postman.com/downloads/). Currently the app supports the following endpoints: 

|    Endpoints    |  Method  |                                                      Description                                                      | Instructions |
|:---------------:|:--------:|:---------------------------------------------------------------------------------------------------------------------:|:------------:|
|   `/handover`   | **POST** |            To perform handover of a current ongoing Live Chat session to the given Omnichannel department.            |   [here](./endpoints/docs/handoverEndpoint.md)   |
| `/availability` |  **GET** | This endpoint can check whether or not the given Salesforce Live Agent Button Id(s) can accept the new chat requests. |   [here](./endpoints/docs/availabilityEndpoint.md)   |

---

# Some Optional App Configurations

## Setting a default welcome message (Auto Greeting)

1. Welcome message is automatically sent to the Live Chat visitor on the successfull initiation of his/her chat session.

2. To enable this message, go to your **Salesforce Dashboard** -> **Setup (In Gear Icon)** -> **Quick Find Search** -> **Search for - Chat Buttons & Invitations** -> **Click on the button you have setup with the app** -> **Click on Edit** -> **Change Auto Greeting field value to the message of your choice** -> **Click on Save**

## Customising app responses

1. You can go to the app setting page and customise app responses as per your requirement. You can customise the app responses for the following events:

	+ Live Agent Events:
    	+ Finding Live Agent.
	    + User placed in a queue.
	    + User is next up in queue.
	    + No Queue.
	    + No Agent Available.
	+ Technical Difficulty.

2. To change this responses, just go to the app setting page and scroll down to the one you want to change. Change the message in the field(s) and click on **Save Changes**. For some messages that has a variable in them, you can use `%s` as a placeholder for that variable.

## Debug Mode

Debug mode is a setting that is intended for the use of Developers to keep track of various Logs and debug message right from the Live Chat widget without the need of keep checking the console. To enable this mode, just toggle the switch to `ON` from the app setting page. **Note:** Only for use in `Developer` environment and not `Production` environment.

## Setting a default Omnichannel department

1. If you have the pre-chat form disabled in your Live Chat or you just want to set a default department to route all new visitor to your preferred Omnichannel department, follow these instructions:

	- Insert your preferred **Department name** to the following function, and this function to your `Live Chat installation script`:

      ```
      RocketChat(function () {
			this.setDepartment("botDepartment");
		});
      ```

	- For example, your script should look like the following, after adding the API function:

      ```
      <script type="text/javascript">
		(function (w, d, s, u) {
			w.RocketChat = function (c) {
				w.RocketChat._.push(c);
			};
			w.RocketChat._ = [];
			w.RocketChat.url = u;
			var h = d.getElementsByTagName(s)[0],
				j = d.createElement(s);
			j.async = true;
			j.src =
				"http://localhost:3000/livechat/rocketchat-livechat.min.js?_=201903270000";
			h.parentNode.insertBefore(j, h);
		})(window, document, "script", "http://localhost:3000/livechat");

		RocketChat(function () {
			this.setDepartment("botDepartment");
		});
	   </script>
      ```

2. Doing this should change your default Omnichannel department.

---
