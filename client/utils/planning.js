import moment from 'moment-timezone'
import { WORKFLOW_STATE, GENERIC_ITEM_ACTIONS, PRIVILEGES, EVENTS } from '../constants/index'
import { get, isNil } from 'lodash'
import {
    getItemWorkflowState,
    isItemLockedInThisSession,
    isItemPublic,
    isItemSpiked,
    eventUtils,
    isItemCancelled,
} from './index'

const canSavePlanning = (planning, event, privileges) => (
    !!privileges[PRIVILEGES.PLANNING_MANAGEMENT] &&
        getItemWorkflowState(planning) !== WORKFLOW_STATE.SPIKED &&
        getItemWorkflowState(event) !== WORKFLOW_STATE.SPIKED
)

const canPublishPlanning = (planning, event, privileges, session, locks) => {
    const planState = getItemWorkflowState(planning)
    const eventState = getItemWorkflowState(event)
    return !!privileges[PRIVILEGES.PUBLISH_PLANNING] &&
        !isPlanningLockRestricted(planning, session, locks) &&
        (planState === WORKFLOW_STATE.DRAFT || planState === WORKFLOW_STATE.KILLED) &&
        eventState !== WORKFLOW_STATE.SPIKED
}

const canUnpublishPlanning = (planning, event, privileges, session, locks) => {
    const planState = getItemWorkflowState(planning)
    const eventState = getItemWorkflowState(event)
    return !!privileges[PRIVILEGES.PUBLISH_PLANNING] &&
        !isPlanningLockRestricted(planning, session, locks) &&
        planState === WORKFLOW_STATE.SCHEDULED &&
        eventState !== WORKFLOW_STATE.SPIKED
}

const canEditPlanning = (
    planning,
    event,
    privileges,
    lockedInThisSession,
    lockedUser
) => (
    getItemWorkflowState(planning) !== WORKFLOW_STATE.SPIKED &&
        getItemWorkflowState(event) !== WORKFLOW_STATE.SPIKED &&
        !!privileges[PRIVILEGES.PLANNING_MANAGEMENT] &&
        !lockedInThisSession &&
        !lockedUser &&
        !isItemCancelled(planning)
)

const canSpikePlanning = (plan, session, privileges, locks) => (
    !isItemPublic(plan) &&
        getItemWorkflowState(plan) === WORKFLOW_STATE.DRAFT &&
        !!privileges[PRIVILEGES.SPIKE_PLANNING] &&
        !!privileges[PRIVILEGES.PLANNING_MANAGEMENT] &&
        !isPlanningLockRestricted(plan, session, locks)
)

const canUnspikePlanning = (plan, event=null, privileges) => (
    isItemSpiked(plan) &&
        !!privileges[PRIVILEGES.UNSPIKE_PLANNING] &&
        !!privileges[PRIVILEGES.PLANNING_MANAGEMENT] &&
        !isItemSpiked(event)
)

const canDuplicatePlanning = (plan, event=null, session, privileges, locks) => (
    !isItemSpiked(plan) &&
        !!privileges[PRIVILEGES.PLANNING_MANAGEMENT] &&
        !self.isPlanningLockRestricted(plan, session, locks) &&
        !isItemSpiked(event)
)

const isPlanningLocked = (plan, locks) =>
    !isNil(plan) && (
        plan._id in locks.planning ||
        get(plan, 'event_item') in locks.events ||
        get(plan, 'recurrence_id') in locks.recurring
    )

const isPlanningLockRestricted = (plan, session, locks) =>
    isPlanningLocked(plan, locks) &&
        !isItemLockedInThisSession(plan, session)

/**
 * Get the array of coverage content type and color base on the scheduled date
 * @param {Array} coverages
 * @returns {Array}
 */
export const mapCoverageByDate = (coverages) => (
    coverages.map((c) => {
        let coverage = {
            g2_content_type: c.planning.g2_content_type || '',
            iconColor: '',
            planning: {
                assigned_to: {
                    user: get(c, 'planning.assigned_to.user'),
                    desk: get(c, 'planning.assigned_to.desk'),
                },
            },
        }

        if (get(c, 'planning.scheduled')) {
            const isAfter = moment(get(c, 'planning.scheduled')).isAfter(moment())
            coverage.iconColor = isAfter ? 'icon--green' : 'icon--red'
        }

        return coverage
    })
)

// ad hoc plan created directly from planning list and not from an event
const isPlanAdHoc = (plan) => !get(plan, 'event_item')

export const getPlanningItemActions = (plan, event=null, session, privileges, actions, locks) => {
    let itemActions = []
    let key = 1

    const actionsValidator = {
        [GENERIC_ITEM_ACTIONS.SPIKE.label]: () =>
            canSpikePlanning(plan, session, privileges, locks),
        [GENERIC_ITEM_ACTIONS.UNSPIKE.label]: () =>
            canUnspikePlanning(plan, event, privileges),
        [GENERIC_ITEM_ACTIONS.DUPLICATE.label]: () =>
            canDuplicatePlanning(plan, event, session, privileges, locks),
        [EVENTS.ITEM_ACTIONS.CANCEL_EVENT.label]: () =>
            !isPlanAdHoc(plan) && eventUtils.canCancelEvent(event, session, privileges, locks),
        [EVENTS.ITEM_ACTIONS.UPDATE_TIME.label]: () =>
            !isPlanAdHoc(plan) && eventUtils.canEditEvent(event, session, privileges, locks),
        [EVENTS.ITEM_ACTIONS.RESCHEDULE_EVENT.label]: () =>
            !isPlanAdHoc(plan) && eventUtils.canRescheduleEvent(event, session, privileges, locks),
        [EVENTS.ITEM_ACTIONS.POSTPONE_EVENT.label]: () =>
            !isPlanAdHoc(plan) && eventUtils.canPostponeEvent(event, session, privileges, locks),
        [EVENTS.ITEM_ACTIONS.CONVERT_TO_RECURRING.label]: () =>
            !isPlanAdHoc(plan) &&
            eventUtils.canConvertToRecurringEvent(event, session, privileges, locks),
    }

    actions.forEach((action) => {
        if (actionsValidator[action.label] && !actionsValidator[action.label]()) {
            return
        }

        switch (action.label) {
            case EVENTS.ITEM_ACTIONS.CANCEL_EVENT.label:
                action.label = 'Cancel Event'
                break

            case EVENTS.ITEM_ACTIONS.UPDATE_TIME.label:
                action.label = 'Update Event Time'
                break

            case EVENTS.ITEM_ACTIONS.RESCHEDULE_EVENT.label:
                action.label = 'Reschedule Event'
                break
            case EVENTS.ITEM_ACTIONS.POSTPONE_EVENT.label:
                action.label = 'Mark Event as Postponed'
                break
        }

        itemActions.push({
            ...action,
            key: `${action.label}-${key}`,
        })

        key++
    })

    return itemActions
}

const self = {
    canSavePlanning,
    canPublishPlanning,
    canUnpublishPlanning,
    canEditPlanning,
    mapCoverageByDate,
    getPlanningItemActions,
    isPlanningLocked,
    isPlanningLockRestricted,
    isPlanAdHoc,
}

export default self
