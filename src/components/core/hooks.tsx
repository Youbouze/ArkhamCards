import { Reducer, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { Navigation, NavigationButtonPressedEvent, ComponentDidAppearEvent } from 'react-native-navigation';
import { forEach, debounce } from 'lodash';

import { Campaign, Deck, DeckMeta, ParsedDeck, Slots } from '@actions/types';
import Card, { CardsMap } from '@data/Card';
import { useDispatch, useSelector } from 'react-redux';
import { AppState, getCampaign, getDeck, getTabooSet } from '@reducers';
import DatabaseContext from '@data/DatabaseContext';
import { parseDeck } from '@lib/parseDeck';
import { fetchPrivateDeck } from '@components/deck/actions';

export function useNavigationButtonPressed(
  handler: (event: NavigationButtonPressedEvent) => void,
  componentId: string,
  deps: any[],
) {
  const debouncedHandler = useCallback(debounce(handler, 1000, { leading: true }), [handler]);
  useEffect(() => {
    const sub = Navigation.events().registerNavigationButtonPressedListener((event: NavigationButtonPressedEvent) => {
      if (event.componentId === componentId) {
        debouncedHandler(event);
      }
    });
    return () => {
      sub.remove();
    };
  }, [componentId, ...deps]);
}

export function useComponentDidAppear(
  handler: (event: ComponentDidAppearEvent) => void,
  componentId: string,
) {
  useEffect(() => {
    const sub = Navigation.events().registerComponentDidAppearListener((event: ComponentDidAppearEvent) => {
      if (event.componentId === componentId) {
        handler(event);
      }
    });
    return () => {
      sub.remove();
    };
  }, [componentId]);
}


interface IncAction {
  type: 'inc';
}
interface DecAction {
  type: 'dec';
}
export function useCounter(initialValue: number, { min, max }: { min?: number; max?: number }): [number, () => void, () => void] {
  const [value, updateValue] = useReducer((state: number, action: IncAction | DecAction) => {
    switch (action.type) {
      case 'inc':
        if (max) {
          return Math.min(max, state + 1);
        }
        return state + 1;
      case 'dec':
        if (min) {
          return Math.max(min, state - 1);
        }
        return state - 1;
    }
  }, initialValue);
  const inc = useCallback(() => {
    updateValue({ type: 'inc' });
  }, [updateValue]);
  const dec = useCallback(() => {
    updateValue({ type: 'dec' });
  }, [updateValue]);
  return [value, inc, dec];
}

interface ClearAction {
  type: 'clear';
}

interface SetToggleAction {
  type: 'set';
  key: string;
  value: boolean;
}

interface ToggleAction {
  type: 'toggle';
  key: string;
}

type SectionToggleAction = SetToggleAction | ToggleAction | ClearAction;

export interface Toggles {
  [key: string]: boolean | undefined;
}

export function useToggles(initialState: Toggles) {
  return useReducer((state: Toggles, action: SectionToggleAction) => {
    switch (action.type) {
      case 'clear':
        return initialState;
      case 'set':
        return {
          ...state,
          [action.key]: action.value,
        };
      case 'toggle':
        return {
          ...state,
          [action.key]: !state[action.key],
        };
    }
  }, initialState);
}


interface ClearAction {
  type: 'clear';
}

interface SlotAction {
  type: 'set-slot';
  code: string;
  value: number;
}

interface SyncAction {
  type: 'sync';
  slots: Slots;
}

interface IncSlotAction {
  type: 'inc-slot';
  code: string;
  max?: number;
}

interface DecSlotAction {
  type: 'dec-slot';
  code: string;
  value: number;
}

type SlotsAction = SlotAction | IncSlotAction | DecSlotAction | ClearAction | SyncAction;

export function useSlots(initialState: Slots, updateSlots?: (slots: Slots) => void) {
  return useReducer((state: Slots, action: SlotsAction) => {
    switch (action.type) {
      case 'clear':
        updateSlots && updateSlots(initialState);
        return initialState;
      case 'sync':
        // Intentionally do not update on this one.
        return action.slots;
      case 'set-slot': {
        const newState = {
          ...state,
          [action.code]: action.value,
        };
        if (!newState[action.code]) {
          delete newState[action.code];
        }
        updateSlots && updateSlots(newState);
        return newState;
      }
      case 'inc-slot': {
        const newState = {
          ...state,
          [action.code]: (state[action.code] || 0) + 1,
        };
        if (action.max && newState[action.code] > action.max) {
          newState[action.code] = action.max;
        }
        updateSlots && updateSlots(newState);
        return newState;
      }
      case 'dec-slot': {
        const newState = {
          ...state,
          [action.code]: (state[action.code] || 0) - 1,
        };
        if (newState[action.code] <= 0) {
          delete newState[action.code];
        }
        updateSlots && updateSlots(newState);
        return newState;
      }
    }
  }, initialState);
}


interface AppendCardsAction {
  type: 'cards';
  cards: Card[]
}

type LoadCardsAction = ClearAction | AppendCardsAction;

function lazyCardMap(indexBy: 'code' | 'id') {
  return (state: CardsMap, action: LoadCardsAction): CardsMap => {
    switch (action.type) {
      case 'clear':
        return {};
      case 'cards': {
        const result: CardsMap = { ...state };
        forEach(action.cards, card => {
          result[card[indexBy]] = card;
        });
        return result;
      }
    }
  };
}

export function useCards(indexBy: 'code' | 'id', initialCards?: Card[]) {
  return useReducer<Reducer<CardsMap, LoadCardsAction>, Card[] | undefined>(
    lazyCardMap(indexBy),
    initialCards,
    (initialCards?: Card[]) => {
      if (initialCards) {
        return lazyCardMap(indexBy)({}, {
          type: 'cards',
          cards: { ...initialCards },
        });
      }
      return {};
    }
  );
}


export function usePlayerCards(tabooSetOverride?: number): CardsMap | undefined {
  const tabooSetId = useSelector((state: AppState) => getTabooSet(state, tabooSetOverride));
  const { playerCardsByTaboo } = useContext(DatabaseContext);
  const playerCards = playerCardsByTaboo && playerCardsByTaboo[`${tabooSetId || 0}`];
  return playerCards?.cards;
}

export function useInvestigatorCards(tabooSetOverride?: number): CardsMap | undefined {
  const tabooSetId = useSelector((state: AppState) => getTabooSet(state, tabooSetOverride));
  const { investigatorCardsByTaboo } = useContext(DatabaseContext);
  return investigatorCardsByTaboo?.[`${tabooSetId || 0}`];
}


export function useWeaknessCards(tabooSetOverride?: number): Card[] | undefined {
  const tabooSetId = useSelector((state: AppState) => getTabooSet(state, tabooSetOverride));
  const { playerCardsByTaboo } = useContext(DatabaseContext);
  const playerCards = playerCardsByTaboo && playerCardsByTaboo[`${tabooSetId || 0}`];
  return playerCards?.weaknessCards;
}

export function useCamapign(campaignId?: number): Campaign | undefined {
  const selector = useCallback((state: AppState) => {
    if (campaignId) {
      return getCampaign(state, campaignId);
    }
    return undefined;
  }, [campaignId]);
  return useSelector(selector);
}

export function useDeck(id: number, { fetchIfMissing }: { fetchIfMissing?: boolean }) {
  const dispatch = useDispatch();
  const deckSelector = useCallback(getDeck(id), [id]);
  const theDeck = useSelector(deckSelector) || undefined;
  const previousDeckSelector = useCallback((state: AppState) => {
    return theDeck && theDeck.previous_deck && getDeck(theDeck.previous_deck)(state);
  }, [theDeck]);
  const thePreviousDeck = useSelector(previousDeckSelector) || undefined;
  useEffect(() => {
    if (!theDeck && fetchIfMissing) {
      dispatch(fetchPrivateDeck(id));
    }
  }, []);
  useEffect(() => {
    if (!thePreviousDeck && theDeck?.previous_deck && fetchIfMissing) {
      dispatch(fetchPrivateDeck(id));
    }
  }, [theDeck]);
  return [theDeck, thePreviousDeck];
}


export function useParsedDeck(
  deck: Deck,
  {
    previousDeck,
    meta,
    slots,
    ignoreDeckLimitSlots,
    xpAdjustment,
  }: {
    previousDeck?: Deck;
    meta?: DeckMeta;
    slots?: Slots;
    ignoreDeckLimitSlots?: Slots;
    xpAdjustment?: number;
  }
): ParsedDeck | undefined {
  const cards = usePlayerCards(deck.taboo_id || 0);
  const parsedDeck = useMemo(() => cards && parseDeck(
    deck,
    meta || deck.meta || {},
    slots || deck.slots,
    ignoreDeckLimitSlots || deck.ignoreDeckLimitSlots,
    cards,
    previousDeck,
    xpAdjustment !== undefined ? xpAdjustment : deck.xp_adjustment,
  ), [cards, deck, meta, slots, ignoreDeckLimitSlots, previousDeck, xpAdjustment]);
  return parsedDeck;
}