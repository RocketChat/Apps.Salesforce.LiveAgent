# Salesforce Live Agent Integration App

<p  align="center">

<img  src="https://user-images.githubusercontent.com/41849970/84944024-d03e0d80-b102-11ea-94fd-b5500dca314d.png">

</p>

A Rocket.Chat marketplace app for Salesforce Live Agent (Chat) Integration.

## Prerequisites

1. Salesforce Org with Live Agent Setup.
    + If you don't have this setup, follow steps [here.](https://github.com/PrajvalRaval/Salesforce-Rocket.Chat-Plugin/blob/master/instructions.md#salesforce-live-agent-setup)
    
1. Rocket Chat Instance with Live Chat Setup.
    + Rocket Chat setup guide [here.](https://docs.rocket.chat/guides/developer/quick-start)
    + Live Chat [guide](https://docs.rocket.chat/guides/administrator-guides/livechat#:~:text=Enable%20Livechat%20feature,Settings%20%3E%20Livechat%20and%20enable%20it.&text=Now%20the%20admin%20will%20have,left%20corner%20drop%20down%20menu.) and [repo](https://github.com/RocketChat/Rocket.Chat.Livechat)
    
1. Rocket.Chat App Engine CLI.
    + Guide [here](https://docs.rocket.chat/apps-development/getting-started)

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

1. **Dialogflow Bot Username** and **Dialogflow Bot Password**

    + Create a new user in Rocket Chat from **Administration** -> **Users**. This user should be created with `bot` and `livechat-agent` roles. Optionally, you can also connect this bot user to Dialogflow using this [app](https://github.com/RocketChat/Apps.Dialogflow/tree/develop-gsoc).
    
    + Go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our bot user to that deparment. 
    
    + Then go to **Administration** -> **Livechat** -> **Routing**. There enable `Assign new conversations to bot agent` Setting. This setting will automatically assign a visitor to this bot.
    
    + Copy and paste this newly created Bot user's username and password in respective fields in our app setting.
    
1. **Salesforce Bot Username** and **Handover Target Department Name**

    + Again create a new user, from **Administration** -> **Users**, with `bot` and `livechat-agent` roles and paste this user's username in **Salesforce Bot Username** setting field.
    
    + Then go to **Omnichannel** -> **Departments** -> **New Department** and create a new department. Assign our new bot user to that deparment. Paste this department name in **Handover Target Department Name** setting field.
    
    + Make sure that Dialogflow Bot user and Salesforce Bot user are in different departments.
    
1. **Salesforce Organization ID**

    + To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for company information -> Click on Company Information option -> Copy Salesforce.com Organization ID value.

1. **Salesforce Deployment ID**

    + To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of deploymentId from Chat Code Snippet.

1. **Salesforce Button ID**

    + To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of buttonId from Chat Code Snippet.

1. That's it for the configuration. Now let's look at the usage.

## App Usage

1. App should be running right away once you complete all required above configuration. But before Make sure your Live Agent is online, before making this session request.

    + To change your Live Agent status to online, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> On the right hand side, you will find an icon name **App Launcher** -> Click on it and go to Service Console.
    
    + On Bottom Bar, click on **Omni-channel** and change status from `Offline` to `Available - Chat`.
    
1. From Live Chat widget, sending the following message will initiate a session with Live Agent.

    ```
    initiate_salesforce_session
    ```

1. Once the Live Agent accepts your chat request, it will perform handoff to our Salesforce bot user and then you can send and recieve messages.
