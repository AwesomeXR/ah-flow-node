import { EventBus } from 'ah-event-bus';

export type FilterString<T> = T extends string ? T : never;

export type PickByStringKey<T> = {
  [K in FilterString<keyof T>]: T[K];
};

export type GetEventBusMeta<T> = T extends EventBus<infer R> ? R : any;
export type AddKeyPrefix<T, P extends string> = {
  [K in keyof T as K extends string ? `${P}${K}` : never]: T[K];
};

export type GetEventBusDelegateMeta<T, P extends string> = AddKeyPrefix<GetEventBusMeta<T>, P>;
