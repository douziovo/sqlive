import type { InjectionKey, Ref, ComputedRef } from 'vue';
import type { DatabaseModel, HighlightState } from '../model/DatabaseTypes';
import type { SchemaTableInfo } from '../utils/aiQuickFix';
import type { AiActions } from './useAiChat';

export const SQL_CONTEXT_KEY: InjectionKey<{
  tabs: Ref<{ id: string; name: string; code: string; dbName: string; isModified: boolean }[]>;
  activeTabId: Ref<string>;
  activeDbName: ComputedRef<string>;
  dbList: Ref<string[]>;
  highlightChunk: Ref<string | null>;
  error: Ref<{ line: number; message: string } | null>;
  schemaTables: ComputedRef<SchemaTableInfo[]>;
  db: DatabaseModel;
  highlight: HighlightState;
}> = Symbol('sqlContext');

export const AI_ACTIONS_KEY: InjectionKey<AiActions> = Symbol('aiActions');
