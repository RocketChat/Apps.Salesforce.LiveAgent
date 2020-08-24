import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { performHandover } from '../../HandoverHelpers';
import { sendDebugLCMessage, sendLCMessage } from '../../LivechatMessageHelpers';
import { getAuthTokens, setBotStatus } from '../../RocketChatAPIHelpers';

export const checkAgentStatusCallbackError = async (error: string, modify: IModify, persistence: IPersistence, message: IMessage, LcAgent: IUser, assoc: RocketChatAssociationRecord) => {
	await persistence.removeByAssociation(assoc);
	sendLCMessage(modify, message.room, error, LcAgent);
	return;
};

export const checkAgentStatusCallbackData = async (
	app: IApp,
	modify: IModify,
	persistence: IPersistence,
	message: IMessage,
	LcAgent: IUser,
	data: any,
	http: IHttp,
	read: IRead,
	rocketChatServerUrl: string,
	salesforceBotUsername: string,
	salesforceBotPassword: string,
	targetDeptName: string,
	technicalDifficultyMessage: string,
	assoc: RocketChatAssociationRecord,
) => {
	const contentData = data.content;
	const contentParsed = JSON.parse(contentData || '{}');
	console.log(InfoLogs.LIVEAGENT_ACCEPTED_CHAT_REQUEST, contentParsed);

	await getAuthTokens(http, rocketChatServerUrl, salesforceBotUsername, salesforceBotPassword)
		.then(async (loginRes) => {
			const { authToken, userId } = loginRes;
			await setBotStatus(http, rocketChatServerUrl, authToken, userId)
				.then(async () => {
					await performHandover(modify, read, message.room.id, targetDeptName);
				})
				.catch(async (statusErr) => {
					console.log(ErrorLogs.SETTING_SALESFORCE_BOT_STATUS_ERROR, statusErr);
					await persistence.removeByAssociation(assoc);
					await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
					await sendDebugLCMessage(read, modify, message.room, `${ErrorLogs.SETTING_SALESFORCE_BOT_STATUS_ERROR} ${statusErr}`, LcAgent);
				});
		})
		.catch(async (loginErr) => {
			console.log(ErrorLogs.LOGIN_SALESFORCE_BOT_ERROR, loginErr);
			await persistence.removeByAssociation(assoc);
			await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(read, modify, message.room, `${ErrorLogs.LOGIN_SALESFORCE_BOT_ERROR}: ${loginErr}`, LcAgent);
		});
};
