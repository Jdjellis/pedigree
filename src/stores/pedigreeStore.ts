import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  PedigreeDocument,
  PedigreeMetadata,
  Individual,
  PartnershipRelationship,
  ParentChildRelationship,
  TwinGroup,
  Position,
  LegendEntry,
} from '../types/pedigree';
import {
  GenderIdentity,
  VitalStatus,
} from '../types/enums';
import { generateId } from '../utils/idGenerator';

/** Build an empty PedigreeDocument with sensible defaults. */
export function createDefaultDocument(): PedigreeDocument {
  return {
    metadata: {
      id: generateId(),
      title: 'Untitled Pedigree',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
    individuals: {},
    partnerships: {},
    parentChildLinks: {},
    twinGroups: {},
    generationOrder: [],
    legendConfig: { entries: [], position: { x: 50, y: 50 } },
  };
}

export function createDefaultIndividual(
  overrides: Partial<Individual> = {}
): Individual {
  return {
    id: generateId(),
    genderIdentity: GenderIdentity.Unknown,
    vitalStatus: VitalStatus.Alive,
    conditionIds: [],
    conditions: [],
    investigations: [],
    isProband: false,
    isPregnancy: false,
    position: { x: 0, y: 0 },
    annotations: [],
    ...overrides,
  };
}

interface PedigreeState {
  document: PedigreeDocument;

  // Individual actions
  addIndividual: (individual: Individual) => void;
  updateIndividual: (id: string, patch: Partial<Individual>) => void;
  removeIndividual: (id: string) => void;
  moveIndividual: (id: string, position: Position) => void;

  // Partnership actions
  addPartnership: (partnership: PartnershipRelationship) => void;
  removePartnership: (id: string) => void;
  addChildToPartnership: (
    partnershipId: string,
    childId: string
  ) => void;
  removeChildFromPartnership: (
    partnershipId: string,
    childId: string
  ) => void;

  // Parent-child link actions
  addParentChildLink: (link: ParentChildRelationship) => void;
  removeParentChildLink: (id: string) => void;

  // Twin group actions
  addTwinGroup: (tg: TwinGroup) => void;
  removeTwinGroup: (id: string) => void;

  // Compound / atomic family actions (each produces one undo step)
  addParentsForChild: (
    parent1: Individual,
    parent2: Individual,
    partnership: PartnershipRelationship,
    link: ParentChildRelationship,
    childId: string,
    childGeneration: number
  ) => void;
  addPartnerToIndividual: (
    partner: Individual,
    partnership: PartnershipRelationship,
  ) => void;
  addChildToFamily: (
    child: Individual,
    partnershipId: string,
    link: ParentChildRelationship,
  ) => void;

  // Legend actions
  addLegendEntry: (entry: LegendEntry) => void;
  updateLegendEntry: (id: string, patch: Partial<LegendEntry>) => void;
  removeLegendEntry: (id: string) => void;
  moveLegend: (position: Position) => void;

  // Document actions
  setDocument: (doc: PedigreeDocument) => void;
  resetDocument: () => void;
  updateMetadata: (patch: Partial<PedigreeMetadata>) => void;
}

type PartializedState = Pick<PedigreeState, 'document'>;

export const usePedigreeStore = create<PedigreeState>()(
  temporal(
    (set) => ({
      document: createDefaultDocument(),

      addIndividual: (individual) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            individuals: {
              ...state.document.individuals,
              [individual.id]: individual,
            },
          },
        })),

      updateIndividual: (id, patch) =>
        set((state) => {
          const existing = state.document.individuals[id];
          if (!existing) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals: {
                ...state.document.individuals,
                [id]: { ...existing, ...patch },
              },
            },
          };
        }),

      removeIndividual: (id) =>
        set((state) => {
          const { [id]: _, ...remainingIndividuals } =
            state.document.individuals;

          // Remove partnerships involving this individual
          const remainingPartnerships: Record<
            string,
            PartnershipRelationship
          > = {};
          for (const [pId, p] of Object.entries(
            state.document.partnerships
          )) {
            if (p.partner1Id === id || p.partner2Id === id) continue;
            remainingPartnerships[pId] = {
              ...p,
              childrenIds: p.childrenIds.filter((cId) => cId !== id),
            };
          }

          // Remove parent-child links involving this individual
          const remainingLinks: Record<string, ParentChildRelationship> =
            {};
          for (const [lId, link] of Object.entries(
            state.document.parentChildLinks
          )) {
            if (link.childId === id) continue;
            // Also remove links referencing deleted partnerships
            if (!remainingPartnerships[link.parentPartnershipId])
              continue;
            remainingLinks[lId] = link;
          }

          // Remove from twin groups
          const remainingTwinGroups: Record<string, TwinGroup> = {};
          for (const [tId, tg] of Object.entries(
            state.document.twinGroups
          )) {
            const filtered = tg.individualIds.filter(
              (iId) => iId !== id
            );
            if (filtered.length >= 2) {
              remainingTwinGroups[tId] = {
                ...tg,
                individualIds: filtered,
              };
            }
          }

          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals: remainingIndividuals,
              partnerships: remainingPartnerships,
              parentChildLinks: remainingLinks,
              twinGroups: remainingTwinGroups,
              generationOrder: state.document.generationOrder.map((gen) =>
                gen.filter((gId) => gId !== id)
              ),
            },
          };
        }),

      moveIndividual: (id, position) =>
        set((state) => {
          const existing = state.document.individuals[id];
          if (!existing) return state;
          return {
            document: {
              ...state.document,
              individuals: {
                ...state.document.individuals,
                [id]: { ...existing, position },
              },
            },
          };
        }),

      addPartnership: (partnership) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            partnerships: {
              ...state.document.partnerships,
              [partnership.id]: partnership,
            },
          },
        })),

      removePartnership: (id) =>
        set((state) => {
          const { [id]: _, ...remaining } = state.document.partnerships;

          // Remove parent-child links referencing this partnership
          const remainingLinks: Record<string, ParentChildRelationship> =
            {};
          for (const [lId, link] of Object.entries(
            state.document.parentChildLinks
          )) {
            if (link.parentPartnershipId !== id) {
              remainingLinks[lId] = link;
            }
          }

          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              partnerships: remaining,
              parentChildLinks: remainingLinks,
            },
          };
        }),

      addChildToPartnership: (partnershipId, childId) =>
        set((state) => {
          const partnership = state.document.partnerships[partnershipId];
          if (!partnership) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              partnerships: {
                ...state.document.partnerships,
                [partnershipId]: {
                  ...partnership,
                  childrenIds: [...partnership.childrenIds, childId],
                },
              },
            },
          };
        }),

      removeChildFromPartnership: (partnershipId, childId) =>
        set((state) => {
          const partnership = state.document.partnerships[partnershipId];
          if (!partnership) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              partnerships: {
                ...state.document.partnerships,
                [partnershipId]: {
                  ...partnership,
                  childrenIds: partnership.childrenIds.filter(
                    (id) => id !== childId
                  ),
                },
              },
            },
          };
        }),

      addParentChildLink: (link) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            parentChildLinks: {
              ...state.document.parentChildLinks,
              [link.id]: link,
            },
          },
        })),

      removeParentChildLink: (id) =>
        set((state) => {
          const { [id]: _, ...remaining } =
            state.document.parentChildLinks;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              parentChildLinks: remaining,
            },
          };
        }),

      addTwinGroup: (tg) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            twinGroups: {
              ...state.document.twinGroups,
              [tg.id]: tg,
            },
          },
        })),

      removeTwinGroup: (id) =>
        set((state) => {
          const { [id]: _, ...remaining } = state.document.twinGroups;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              twinGroups: remaining,
            },
          };
        }),

      addParentsForChild: (parent1, parent2, partnership, link, childId, childGeneration) =>
        set((state) => {
          const existing = state.document.individuals[childId];
          if (!existing) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals: {
                ...state.document.individuals,
                [parent1.id]: parent1,
                [parent2.id]: parent2,
                [childId]: { ...existing, generation: childGeneration },
              },
              partnerships: {
                ...state.document.partnerships,
                [partnership.id]: partnership,
              },
              parentChildLinks: {
                ...state.document.parentChildLinks,
                [link.id]: link,
              },
            },
          };
        }),

      addPartnerToIndividual: (partner, partnership) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            individuals: {
              ...state.document.individuals,
              [partner.id]: partner,
            },
            partnerships: {
              ...state.document.partnerships,
              [partnership.id]: partnership,
            },
          },
        })),

      addChildToFamily: (child, partnershipId, link) =>
        set((state) => {
          const partnership = state.document.partnerships[partnershipId];
          if (!partnership) return state;
          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals: {
                ...state.document.individuals,
                [child.id]: child,
              },
              partnerships: {
                ...state.document.partnerships,
                [partnershipId]: {
                  ...partnership,
                  childrenIds: [...partnership.childrenIds, child.id],
                },
              },
              parentChildLinks: {
                ...state.document.parentChildLinks,
                [link.id]: link,
              },
            },
          };
        }),

      addLegendEntry: (entry) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            legendConfig: {
              ...state.document.legendConfig,
              entries: [...state.document.legendConfig.entries, entry],
            },
          },
        })),

      updateLegendEntry: (id, patch) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              updatedAt: new Date().toISOString(),
            },
            legendConfig: {
              ...state.document.legendConfig,
              entries: state.document.legendConfig.entries.map((e) =>
                e.id === id ? { ...e, ...patch } : e,
              ),
            },
          },
        })),

      removeLegendEntry: (id) =>
        set((state) => {
          // Remove from legend and cascade-remove from all individuals
          const updatedIndividuals: Record<string, Individual> = {};
          for (const [iId, ind] of Object.entries(
            state.document.individuals,
          )) {
            updatedIndividuals[iId] = {
              ...ind,
              conditionIds: ind.conditionIds.filter((cId) => cId !== id),
            };
          }

          return {
            document: {
              ...state.document,
              metadata: {
                ...state.document.metadata,
                updatedAt: new Date().toISOString(),
              },
              individuals: updatedIndividuals,
              legendConfig: {
                ...state.document.legendConfig,
                entries: state.document.legendConfig.entries.filter(
                  (e) => e.id !== id,
                ),
              },
            },
          };
        }),

      moveLegend: (position) =>
        set((state) => ({
          document: {
            ...state.document,
            legendConfig: {
              ...state.document.legendConfig,
              position,
            },
          },
        })),

      setDocument: (doc) => set({ document: doc }),

      resetDocument: () => set({ document: createDefaultDocument() }),

      updateMetadata: (patch) =>
        set((state) => ({
          document: {
            ...state.document,
            metadata: {
              ...state.document.metadata,
              ...patch,
              updatedAt: new Date().toISOString(),
            },
          },
        })),
    }),
    {
      partialize: (state): PartializedState => ({
        document: state.document,
      }),
      limit: 100,
    }
  )
);
