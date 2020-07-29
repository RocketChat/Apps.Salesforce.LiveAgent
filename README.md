# Salesforce Live Agent Integration App

<p align="center">

<img  src="https://user-images.githubusercontent.com/41849970/88032175-392e0080-cb5b-11ea-9868-b8d2526c22e2.png">

</p>

A Rocket.Chat marketplace app for Salesforce Live Agent (Chat) Integration.

## Prerequisites

1. Salesforce Org with Live Agent Setup.

2. Rocket Chat Instance with Live Chat Setup.

   - Rocket Chat >= v3.5.0
   - Rocket Chat setup guide [here.](https://docs.rocket.chat/guides/developer/quick-start)
   - Live Chat [guide](https://docs.rocket.chat/guides/administrator-guides/livechat#:~:text=Enable%20Livechat%20feature,Settings%20%3E%20Livechat%20and%20enable%20it.&text=Now%20the%20admin%20will%20have,left%20corner%20drop%20down%20menu.) and [repo](https://github.com/RocketChat/Rocket.Chat.Livechat)

3. Rocket.Chat App Engine CLI.
   - Guide [here](https://docs.rocket.chat/apps-development/getting-started#rocket-chat-app-engine-cli)

## App Installation

1. Clone This Repo

   `git clone https://github.com/RocketChat/Apps.Salesforce.LiveAgent`

1. Change to root directory

   `cd Apps.Salesforce.LiveAgent`

1. Install NPM Packages

   `npm install`

1. Deploy to your Rocket Chat Server

   `rc-apps deploy --url <YOUR SERVER URL> --username <YOUR ADMIN USERNAME> --password <YOUR ADMIN PASSWORD>`

1. In Rocket Chat Server, you can now go to **Administration** -> **Apps** and you access our app from there.

## App Configuration

1. **Salesforce Bot Username & Password** and **Handover Target Department Name**

   - Again create a new user, from **Administration** -> **Users**, with `bot` and `livechat-agent` roles and paste this user's username and password in respective fields in our app setting.

   - Then go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our new bot user to that deparment. Paste this department name in **Handover Target Department Name** setting field. **Note:** Make sure to never add any other user other than the one we just added in this department.

   - Make sure that Dialogflow Bot user and Salesforce Bot user are in different departments.

1. **Salesforce Organization ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for company information -> Click on Company Information option -> Copy Salesforce.com Organization ID value.

1. **Salesforce Deployment ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of deploymentId from Chat Code Snippet.

1. **Salesforce Button ID**

   - To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of buttonId from Chat Code Snippet.

1. **Debug Mode**

   - Enabling this setting will send debug messages and log to the Live Chat user. Setting only intended for Developer testing not for production.

## Bot Configuration

1. This app requires a Bot user to initialize session with Salesforce Live Agent. You can use any existing bot user or create a new one.

1. Go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our bot user to that deparment.

1. Then go to **Administration** -> **Livechat** -> **Routing**. There enable Assign new conversations to bot agent Setting. This setting will automatically assign a visitor to this bot.

1. Finally we will make changes to your Livechat Widget installation script. Go to your installation script and add the following code to it:

   - Insert your **Department name** which consists the bot user in the following function:

   ```
   RocketChat(function() {
		this.setDepartment('<INSERT YOUR BOT DEPARMENT NAME HERE>');
		this.onChatEnded(function() {
			window.location.reload();
    	});
	});
   ```
   - For example, your script should look like this after adding the API functions:

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

## App Usage

1. App should be running right away once you complete all required above configuration. Make sure your Live Agent is online, before making any session request.

   - To change your Live Agent status to online, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> On the right hand side, you will find an icon named **App Launcher** <img width="32" alt="Screenshot 2020-07-08 at 9 03 50 PM" src="https://user-images.githubusercontent.com/41849970/86938913-9939a580-c15e-11ea-8544-9aefab50555b.png"> -> Click on it and go to **Service Console**.

   - On Bottom Bar, click on **Omni-channel** and change status from `Offline` to `Available - Chat`.

1. From Live Chat widget, sending the following message will initiate a session with Live Agent:

   ```
   initiate_salesforce_session
   ```

1. Once the Live Agent accepts your chat request, it will perform handoff to our Salesforce bot user and then you can send and recieve messages from Salesforce Live Agent.

1. Due to Long Message Polling Loop, if Live Chat user is idle for `40` seconds. Session is automatically expired.
