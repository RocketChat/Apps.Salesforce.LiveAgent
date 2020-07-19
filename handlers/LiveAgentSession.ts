import {
  IHttp,
  IModify,
  IPersistence,
  IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import {
  ILivechatMessage,
  ILivechatRoom,
} from '@rocket.chat/apps-engine/definition/livechat';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages';
import {
  RocketChatAssociationModel,
  RocketChatAssociationRecord,
} from '@rocket.chat/apps-engine/definition/metadata';
// import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { retrievePersistentTokens } from '../helperFunctions/GeneralHelpers';
// import { sendLCMessage } from '../helperFunctions/GeneralHelpers';
import { SalesforceHelpers } from '../helperFunctions/SalesforceHelpers';

export class LiveAgentSession {
  constructor(
	private message: IMessage,
	private read: IRead,
	private http: IHttp,
	private persistence: IPersistence,
	private modify: IModify,
  ) {}

  public async exec() {
	try {
		let salesforceChatApiEndpoint: string = (
		await this.read
			.getEnvironmentReader()
			.getSettings()
			.getById('salesforce_chat_api_endpoint')
		).value;
		salesforceChatApiEndpoint = salesforceChatApiEndpoint.replace(
		/\/?$/,
		'/',
		);

		const salesforceBotUsername: string = (
		await this.read
			.getEnvironmentReader()
			.getSettings()
			.getById('salesforce_bot_username')
		).value;

		// const lmessage: ILivechatMessage = this.message;
		// const lroom: ILivechatRoom = lmessage.room as ILivechatRoom;
		// const LcAgent: IUser = lroom.servedBy
		// ? lroom.servedBy
		// : this.message.sender;

		if (
		this.message.sender.username === salesforceBotUsername ||
		this.message.text === 'initiate_salesforce_session'
		) {
		return;
		}

		const assoc = new RocketChatAssociationRecord(
		RocketChatAssociationModel.ROOM,
		this.message.room.id,
		);

		const {
		persisantAffinity,
		persistantKey,
		} = await retrievePersistentTokens(this.read, assoc);

		const salesforceHelpers: SalesforceHelpers = new SalesforceHelpers();

		if (
		this.message.text === 'Closed by visitor' &&
		persisantAffinity &&
		persistantKey
		) {
		await salesforceHelpers
			.closeChat(
			this.http,
			salesforceChatApiEndpoint,
			persisantAffinity,
			persistantKey,
			)
			.then(async (res) => {
			console.log('Closing Liveagent Chat, Response:', res);
			await this.persistence.removeByAssociation(assoc);
			})
			.catch((error) => {
			console.log('Closing Liveagent Chat, Error:', error);
			});
		}

		if (
		this.message.text !== 'Closed by visitor' &&
		persisantAffinity &&
		persistantKey
		) {
		let messageText = '';
		if (this.message.text) {
			messageText = this.message.text;
		}
		await salesforceHelpers
			.sendMessages(
			this.http,
			salesforceChatApiEndpoint,
			persisantAffinity,
			persistantKey,
			messageText,
			)
			.then((res) => {
			console.log('Sending Message To Liveagent, Response:', res);
			})
			.catch((error) => {
			console.log('Sending Message To Liveagent, Error:', error);
			});
		}

		// // const { http, modify, read, persistence, message } = this;
		// const { http, modify, read, message } = this;

		// // your callback gets executed automatically once the data is received
		// const handleEndChatCallback = async (data, error) => {
		// if (error) {
		// 	console.error(error);

		// 	if (error === 'out of retries') {
		// 	await sendLCMessage(
		// 		modify,
		// 		message.room,
		// 		'Connection lost. Please Send a message to reinitiate session',
		// 		LcAgent,
		// 	);
		// 	}
		// 	return;
		// }
		// await this.persistence.removeByAssociation(assoc);

		// await sendLCMessage(modify, message.room, data, LcAgent);

		// return;
		// // PROBABLY ADD A CHECK TO LET USER DECIDE WHETHER TO REINITIATE SESSION
		// };

		// async function subscribeToLiveAgent(retries: number, callback: any) {
		// await salesforceHelpers
		// 	.pullMessages(
		// 	http,
		// 	salesforceChatApiEndpoint,
		// 	persisantAffinity,
		// 	persistantKey,
		// 	)
		// 	.then(async (response) => {
		// 	if (response.statusCode === 403) {
		// 		console.log(
		// 		'Pulling Messages using Subscribe Function, Session Expired.',
		// 		);
		// 		callback('Chat Session Expired');
		// 	} else if (
		// 		response.statusCode === 204 ||
		// 		response.statusCode === 409
		// 	) {
		// 		console.log(
		// 		'Pulling Messages using Subscribe Function, Empty Response.',
		// 		);

		// 		if (retries > 0) {
		// 		console.log(
		// 			'Executing Subscribe Function, EMPTY RESPONSE ENTRY, Retries Remaining: ',
		// 			retries,
		// 		);
		// 		await subscribeToLiveAgent(
		// 			--retries,
		// 			callback,
		// 			// persisantAffinity,
		// 			// persistantKey,
		// 		);
		// 		} else {
		// 		// no retries left, calling callback with error
		// 		callback([], 'out of retries');
		// 		}
		// 	} else {
		// 		// request successful
		// 		console.log(
		// 		'Pulling Messages using Subscribe Function, response here:',
		// 		response,
		// 		);

		// 		const { content } = response;
		// 		const contentParsed = JSON.parse(content || '{}');

		// 		const messageArray = contentParsed.messages;
		// 		const isEndChat = salesforceHelpers.checkForEvent(
		// 		messageArray,
		// 		'ChatEnded',
		// 		);
		// 		console.log('Chat ended by Agent: ', isEndChat);

		// 		if (isEndChat === true) {
		// 		console.log(
		// 			'Pulling Messages using Subscribe Function, Chat Ended By Live Agent.',
		// 		);
		// 		callback('Chat Ended By Live Agent');
		// 		} else {
		// 		// server not done yet
		// 		// retry, if any retries left

		// 		await salesforceHelpers.messageFilter(
		// 			modify,
		// 			read,
		// 			// persistence,
		// 			// assoc,
		// 			message.room,
		// 			LcAgent,
		// 			messageArray,
		// 		);

		// 		if (retries > 0) {
		// 			console.log(
		// 			'Executing Subscribe Function, MESSAGE RESPONSE ENTRY, Retries Remaining: ',
		// 			retries,
		// 			);
		// 			await subscribeToLiveAgent(
		// 			--retries,
		// 			callback,
		// 			// persisantAffinity,
		// 			// persistantKey,
		// 			);
		// 		} else {
		// 			// no retries left, calling callback with error
		// 			callback([], 'out of retries');
		// 		}
		// 		}
		// 	}
		// 	})
		// 	.catch(async (error) => {
		// 	console.log(
		// 		'Pulling Messages using Subscribe Function, error here:',
		// 		error,
		// 	);
		// 	// ajax error occurred
		// 	// would be better to not retry on 404, 500 and other unrecoverable HTTP errors
		// 	// retry, if any retries left
		// 	if (retries > 0) {
		// 		console.log(
		// 		'Executing Subscribe Function, CATCH ENTRY, Retries Remaining: ',
		// 		retries,
		// 		);
		// 		await subscribeToLiveAgent(
		// 		--retries,
		// 		callback,
		// 		// persisantAffinity,
		// 		// persistantKey,
		// 		);
		// 	} else {
		// 		// no retries left, calling callback with error
		// 		callback([], error);
		// 	}
		// 	});
		// }

		// if (persisantAffinity && persistantKey) {
		// console.log(
		// 	'Executing Subscribe Function, MAIN ENTRY, Retries Remaining: 10 (~5 Mins)',
		// );
		// await subscribeToLiveAgent(10, handleEndChatCallback);
		// }
	} catch (error) {
		console.log('Handling Live Agent Session, Error: ', error);
	}
  }
}
