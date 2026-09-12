import {
  getSentenceById,
  getSentenceDetails,
  handleCreateSentence,
  handleDeleteSentence,
  handleGetSentence,
  handleListSentences,
  handleUpdateSentence,
  handleUpdateSentenceLexicals,
} from '../sentences/handlers.ts';

export const getTextById = getSentenceById;
export const getTextDetails = getSentenceDetails;
export const handleListTexts = handleListSentences;
export const handleGetText = handleGetSentence;
export const handleCreateText = handleCreateSentence;
export const handleUpdateText = handleUpdateSentence;
export const handleDeleteText = handleDeleteSentence;
export const handleUpdateTextLexicals = handleUpdateSentenceLexicals;
