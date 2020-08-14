import { IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export async function retrievePersistentTokens(read: IRead, assoc: RocketChatAssociationRecord) {
	const awayDatas = await read.getPersistenceReader().readByAssociation(assoc);
	if (awayDatas[0]) {
		const contentStringified = JSON.stringify(awayDatas[0]);
		const contentParsed = JSON.parse(contentStringified);

		return {
			persisantAffinity: contentParsed.affinityToken as string,
			persistantKey: contentParsed.key as string,
		};
	}

	return {
		persisantAffinity: null,
		persistantKey: null,
	};
}
