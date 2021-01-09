import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export async function retrievePersistentTokens(read: IRead, assoc: RocketChatAssociationRecord) {
	try {
		const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
		if (awayDatas[0]) {
			const contentStringified = JSON.stringify(awayDatas[0]);
			const contentParsed = JSON.parse(contentStringified);

			return {
				id: contentParsed.id,
				persisantAffinity: contentParsed.affinityToken as string,
				persistantKey: contentParsed.key as string,
			};
		}

		return {
			id: null,
			persisantAffinity: null,
			persistantKey: null,
		};
	} catch (error) {
		throw new Error(error);
	}
}

export async function retrievePersistentData(read: IRead, assoc: RocketChatAssociationRecord) {
	try {
		const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
		if (awayDatas[0]) {
			const contentStringified = JSON.stringify(awayDatas[0]);
			const contentParsed = JSON.parse(contentStringified);

			return {
				id: contentParsed.id,
				chasitorIdleTimeout: contentParsed.chasitorIdleTimeout,
				persisantAffinity: contentParsed.affinityToken as string,
				persistantKey: contentParsed.key as string,
				sneakPeekEnabled: contentParsed.sneakPeekEnabled as boolean,
			};
		}

		return {
			id: null,
			chasitorIdleTimeout: null,
			persisantAffinity: null,
			persistantKey: null,
			sneakPeekEnabled: null,
		};
	} catch (error) {
		throw new Error(error);
	}
}
