import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApp } from '@rocket.chat/apps-engine/definition/IApp';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { ErrorLogs } from '../../../enum/ErrorLogs';
import { InfoLogs } from '../../../enum/InfoLogs';
import { performHandover } from '../../HandoverHelpers';
import { sendDebugLCMessage, sendLCMessage } from '../../LivechatMessageHelpers';
import { getAuthTokens, setBotStatus } from '../../RocketChatAPIHelpers';

export const checkAgentStatusCallbackError = async (error: string, modify: IModify, message: IMessage, LcAgent: IUser) => {
	sendLCMessage(modify, message.room, error, LcAgent);
	return;
};

export const checkAgentStatusCallbackData = async (
	app: IApp,
	modify: IModify,
	message: IMessage,
	LcAgent: IUser,
	data: any,
	http: IHttp,
	persistence: IPersistence,
	read: IRead,
	rocketChatServerUrl: string,
	salesforceBotUsername: string,
	salesforceBotPassword: string,
	id: string,
	affinityToken: string,
	key: string,
	targetDeptName: string,
	technicalDifficultyMessage: string,
) => {
	const contentData = data.content;
	const contentParsed = JSON.parse(contentData || '{}');
	console.log(InfoLogs.LIVEAGENT_ACCEPTED_CHAT_REQUEST, contentParsed);

	await getAuthTokens(http, rocketChatServerUrl, salesforceBotUsername, salesforceBotPassword)
		.then(async (loginRes) => {
			const { authToken, userId } = loginRes;
			await setBotStatus(http, rocketChatServerUrl, authToken, userId)
				.then(async () => {
					const assoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, message.room.id);
					const sessionTokens = { id, affinityToken, key };
					await persistence.createWithAssociation(sessionTokens, assoc);

					await performHandover(modify, read, message.room.id, targetDeptName);
				})
				.catch(async (statusErr) => {
					console.log(ErrorLogs.SETTING_SALESFORCE_BOT_STATUS_ERROR, statusErr);
					await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
					await sendDebugLCMessage(read, modify, message.room, `${ErrorLogs.SETTING_SALESFORCE_BOT_STATUS_ERROR} ${statusErr}`, LcAgent);
				});
		})
		.catch(async (loginErr) => {
			console.log(ErrorLogs.LOGIN_SALESFORCE_BOT_ERROR, loginErr);
			await sendLCMessage(modify, message.room, technicalDifficultyMessage, LcAgent);
			await sendDebugLCMessage(read, modify, message.room, `${ErrorLogs.LOGIN_SALESFORCE_BOT_ERROR}: ${loginErr}`, LcAgent);
		});
};
