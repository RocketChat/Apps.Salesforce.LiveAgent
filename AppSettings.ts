import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export enum AppSettingId {
	SalesforceBotUsername = 'salesforce_bot_username',
	SalesforceBotPassword = 'salesforce_bot_password',
	SalesforceChatApiEndpoint = 'salesforce_chat_api_endpoint',
	SalesforceOrganisationId = 'salesforce_organisation_id',
	SalesforceDeploymentId = 'salesforce_deployment_id',
	SalesforceButtonId = 'salesforce_button_id',
	HandoverDepartmentName = 'handover_department_name',
	DebugButton = 'debug_button',
}

export const AppSettings: Array<ISetting> = [
	{
		id: AppSettingId.SalesforceBotUsername,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Salesforce Bot Username',
		i18nDescription: 'Enter Omnichannel agent username we will be using as Salesforce Live Agent.',
		required: true,
	},
	{
		id: AppSettingId.SalesforceBotPassword,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Salesforce Bot Password',
		i18nDescription: 'Enter Omnichannel agent password we will be using as Salesforce Live Agent.',
		required: true,
	},
	{
		id: AppSettingId.SalesforceChatApiEndpoint,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Salesforce Chat Endpoint',
		i18nDescription:
			'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for chat setting -> Click on Chat Settings option -> Copy Chat API Endpoint value.',
		required: true,
	},
	{
		id: AppSettingId.SalesforceOrganisationId,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Salesforce Organization ID',
		i18nDescription:
			'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for company information -> Click on Company Information option -> Copy Salesforce.com Organization ID	value.',
		required: true,
	},
	{
		id: AppSettingId.SalesforceDeploymentId,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Salesforce Deployment ID',
		i18nDescription:
			'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of deploymentId from Chat Code Snippet.',
		required: true,
	},
	{
		id: AppSettingId.SalesforceButtonId,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Salesforce Button ID',
		i18nDescription:
			'To find this value, go to your Salesforce Dashboard -> Setup (In Gear Icon) -> Quick Find Search -> Search for embedded service deployments -> Click on Embedded Service Deployments option -> Locate current chat group and click on View -> From Embedded Service Code Snippets option, click on Get Code -> Locate the value of buttonId from Chat Code Snippet.',
		required: true,
	},
	{
		id: AppSettingId.HandoverDepartmentName,
		public: true,
		type: SettingType.STRING,
		packageValue: '',
		i18nLabel: 'Handover Target Department Name',
		i18nDescription: 'Enter Omnichannel department name containing Salesforce agent user.',
		required: true,
	},
	{
		id: AppSettingId.DebugButton,
		public: true,
		type: SettingType.BOOLEAN,
		packageValue: false,
		i18nLabel: 'Debug Mode',
		i18nDescription: 'This mode enables debug messages for your app.',
		required: false,
	},
];
