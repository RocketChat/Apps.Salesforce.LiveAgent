# Salesforce Live Agent Integration App

<p align="center">

<img  src="https://user-images.githubusercontent.com/41849970/88838683-895e3000-d1f7-11ea-8d5d-1a3e1d82b30d.png">

</p>

Integration between Rocket.Chat and the Salesforce Live Agent (Chat).

## Prerequisites

1. Salesforce Org with Live Agent Setup.

2. Rocket Chat Instance with Live Chat Setup.

   - Rocket Chat >= v3.5.0
   - Rocket Chat setup guide [here.](https://docs.rocket.chat/guides/developer/quick-start)
   - Live Chat [guide](https://docs.rocket.chat/guides/administrator-guides/livechat#:~:text=Enable%20Livechat%20feature,Settings%20%3E%20Livechat%20and%20enable%20it.&text=Now%20the%20admin%20will%20have,left%20corner%20drop%20down%20menu.) and [repo](https://github.com/RocketChat/Rocket.Chat.Livechat)

3. Rocket.Chat App Engine CLI.
   - Guide [here](https://docs.rocket.chat/apps-development/getting-started#rocket-chat-app-engine-cli)

---

## App Installation

1. Clone this repository

   `git clone https://github.com/RocketChat/Apps.Salesforce.LiveAgent`

1. Change to root directory

   `cd Apps.Salesforce.LiveAgent`

1. Install NPM Packages

   `npm install`

1. Deploy to your Rocket Chat Server

   `rc-apps deploy --url <YOUR SERVER URL> --username <YOUR ADMIN USERNAME> --password <YOUR ADMIN PASSWORD>`

1. In Rocket Chat Server, you can now go to **Administration** -> **Apps** and you access our app from there.

---

## App Configuration

1. **Salesforce Bot Username & Password** and **Handover Target Department Name**

   - Create a new user from **Administration** -> **Users**, after filling all the details add, `bot` and `livechat-agent` roles. Paste this user's username and password in respective fields in app setting.

   - Then go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our new bot user to that deparment. Paste this department name in **Handover Target Department Name** setting field. **Note:** Make sure to never add any other user other than the one we just added in this department.

2. **Salesforce Organization ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for company information -> Click on Company Information option -> Copy Salesforce.com Organization ID value.

3. **Salesforce Deployment ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of deploymentId from Chat Code Snippet.

4. **Salesforce Button ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of buttonId from Chat Code Snippet.

5. **Chat Bot Configurations**

   - Please refer to the following section to configure this setting.

---

## Chat Bot Configuration

1. This app requires a Bot user to be used along side Salesforce Live Agent user bot. This bot user can either be used to initiate a session with Live Agent or incase, Live Agent ends chat event, app automatically performs a handover to this bot. You can use any existing bot user or create a new one.

2. To create a new Chat Bot user, go to **Administration** -> **Users**, after filling all the details add, `bot` and `livechat-agent` roles. Paste this user's username and password in Chat Bot fields in app setting.

3. Go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our bot user to this new deparment. Paste this department name in `Chat Bot Department Name` field in app setting

4. Then go to **Administration** -> **Livechat** -> **Routing**. There enable Assign new conversations to bot agent Setting. This setting will automatically assign a new Live Chat visitor to a bot user, depending on which department the visior is in.

5. This ends our required app configuration. Following are the instructions on how to use the app.

---

## App Usage

1. App should be running right away once you complete all required above configurations. Make sure your Live Agent is online, before making any session request.

   - To change your Live Agent status to online, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> On the right hand side, you will find an icon named **App Launcher** <img width="32" alt="Screenshot 2020-07-08 at 9 03 50 PM" src="https://user-images.githubusercontent.com/41849970/86938913-9939a580-c15e-11ea-8544-9aefab50555b.png"> -> Click on it and go to **Service Console**.

   - On Bottom Bar, click on **Omni-channel** and change status from `Offline` to `Available - Chat`.

1. Once your Live Agent is online and ready to take new rquests. Go to your Rocket Chat Live Chat widget to initiate a session. Now you can initiate in either of the two ways:

	1. You can use the department with the Chat Bot user. If you are using this department and the Chat Bot is assigned as your Live Chat agent, you can send the following message to initiate a new session with Salesforce Liveagent:

	   ```
	   initiate_salesforce_session
	   ```

	1. You can use the department with Live Agent Bot user. If you are using this department, once you send any message and the Live Agent Bot user is assigned to you. It will automatically initiate a new session for you with the Salesforce Liveagent. In case the Live agent ends your chat or there is some technical error, you will be automatically handover to the Chat Bot Department.

---

## REST API Endpoints

REST API Endpoints can be used to trigger specific actions in the app. You can go to the app setting page and get the complete URLs to make an API call using `cURL` or any other software of your choice, for example [Postman](https://www.postman.com/downloads/). Currently the app supports the following endpoints: 

|    Endpoints    |  Method  |                                                      Description                                                      | Instructions |
|:---------------:|:--------:|:---------------------------------------------------------------------------------------------------------------------:|:------------:|
|   `/handover`   | **POST** |            To perform handover of a current ongoing Live Chat session to the given Omnichannel department.            |   [here](./endpoints/docs/handoverEndpoint.md)   |
| `/availability` |  **GET** | This endpoint can check whether or not the given Salesforce Live Agent Button Id(s) can accept the new chat requests. |   [here](./endpoints/docs/availabilityEndpoint.md)   |

---

# Some Optional App Configurations

## Customising app responses

1. You can go to the app setting page and customise app responses as per your requirement. You can customise the app responses for the following events:

+ Live Agent Chat Ended.
+ Live Agent Queue Position.
+ Live Agent Queue Empty.
+ Live Agent No Queue.
+ No Live Agent Available.
+ Technical Difficulty.

2. To change this responses, just go to the app setting page and scroll down to the one you want to change. Change the message in the field(s) and click on **Save Changes**. For some messages that has a variable in them, you can use `%s` as a placeholder for that variable.

## Debug Mode

Debug mode is a setting that is intended for the use of Developers to keep track of various Logs and debug message right from the Live Chat widget without the need of keep checking the console. To enable this mode, just toggle the switch to `ON` from the app setting page. **Note:** Only for use in `Developer` environment and not `Production` environment.

## Setting a default Omnichannel department

1. If you have the pre-chat form disabled in your Live Chat or you just want to set a default department to route all new visitor to your preferred Omnichannel department, follow these instructions:

	- Insert your preferred **Department name** to the following function, and this function to your Live Chat installation script:

		```
	   	RocketChat(function() {
			this.setDepartment('<INSERT YOUR BOT DEPARMENT NAME HERE>');
			this.onChatEnded(function() {
				window.location.reload();
			});
		});
	   ```
	- For example, your script should look like the following, after adding the API function:

		```
   		<script type="text/javascript">
		(function(w, d, s, u) {
			w.RocketChat = function(c) { w.RocketChat._.push(c) }; w.RocketChat._ = []; w.RocketChat.url = u;
			var h = d.getElementsByTagName(s)[0], j = d.createElement(s);
			j.async = true; j.src = 'http://localhost:3000/livechat/rocketchat-livechat.min.js?_=201903270000';
			h.parentNode.insertBefore(j, h);
		})(window, document, 'script', 'http://localhost:3000/livechat');

		RocketChat(function() {
			this.setDepartment('botDepartment');
			this.onChatEnded(function() {
				window.location.reload();
    			});
		});
		</script>
   	```

1. Doing this should change your default Omnichannel department.

---