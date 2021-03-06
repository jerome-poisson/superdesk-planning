import React from 'react'
import { reduxForm } from 'redux-form'
import { connect } from 'react-redux'
import * as actions from '../../actions'
import { PlanningForm } from '../index'
import { EventMetadata } from '../../components'
import * as selectors from '../../selectors'
import { ITEM_STATE } from '../../constants'
import { get } from 'lodash'
import moment from 'moment'
import { OverlayTrigger } from 'react-bootstrap'
import { tooltips } from '../index'
import { UserAvatar, UnlockItem } from '../'
import classNames from 'classnames'
import './style.scss'

export class EditPlanningPanel extends React.Component {

    constructor(props) {
        super(props)
        this.state = { openUnlockPopup: false }
    }

    handleSave() {
        this.refs.PlanningForm.getWrappedInstance().submit()
    }

    toggleOpenUnlockPopup() {
        this.setState({ openUnlockPopup: !this.state.openUnlockPopup })
    }

    getLockedUser(planning) {
        return get(planning, 'lock_user') && Array.isArray(this.props.users) ?
            this.props.users.find((u) => (u._id === planning.lock_user)) : null
    }

    getCreator(planning, creator) {
        const user = get(planning, creator)
        if (user) {
            return user.display_name ? user : this.props.users.find((u) => (u._id === user))
        }
    }

    /*eslint-disable complexity*/
    render() {
        const { closePlanningEditor, openPlanningEditor, planning, event, pristine, submitting, agendaSpiked, readOnly, lockedInThisSession } = this.props
        const creationDate = get(planning, '_created')
        const updatedDate = get(planning, '_updated')

        const author = this.getCreator(planning, 'original_creator')
        const versionCreator = this.getCreator(planning, 'version_creator')

        const planningSpiked = planning ? get(planning, 'state', 'active') === ITEM_STATE.SPIKED : false
        const eventSpiked = event ? get(event, 'state', 'active') === ITEM_STATE.SPIKED : false
        const lockedUser = this.getLockedUser(planning)

        // If the planning or event or agenda item is spiked,
        // or we don't hold a lock, enforce readOnly
        let forceReadOnly = readOnly
        if (!lockedInThisSession || agendaSpiked || eventSpiked || planningSpiked) {
            forceReadOnly = true
        }

        return (
            <div className="EditPlanningPanel">
                <header>
                    <div className={classNames('TimeAndAuthor',
                        'dropdown',
                        'dropdown--drop-right',
                        'pull-left',
                        { 'open': this.state.openUnlockPopup })}>
                        {(!readOnly && !lockedInThisSession && lockedUser)
                            && (
                            <div className="lock-avatar">
                                <button type='button' onClick={this.toggleOpenUnlockPopup.bind(this)}>
                                    <UserAvatar user={lockedUser} withLoggedInfo={true}/>
                                </button>
                                {this.state.openUnlockPopup && <UnlockItem user={lockedUser}
                                    showUnlock={this.props.unlockPrivilege}
                                    onCancel={this.toggleOpenUnlockPopup.bind(this)}
                                    onUnlock={this.props.unlockItem.bind(this, planning)}/>}
                            </div>
                            )}
                        {creationDate && author &&
                            <div>Created {moment(creationDate).fromNow()} by <span className='TimeAndAuthor__author'> {author.display_name}</span>
                            </div>
                        }
                        {updatedDate && versionCreator &&
                            <div>Updated {moment(updatedDate).fromNow()} by <span className='TimeAndAuthor__author'> {versionCreator.display_name}</span>
                            </div>
                        }
                    </div>
                    { !forceReadOnly && <div className="EditPlanningPanel__actions">
                            <button
                                className="btn"
                                type="reset"
                                onClick={closePlanningEditor.bind(this, planning)}
                                disabled={submitting}>Cancel</button>
                            {!agendaSpiked && !planningSpiked && !eventSpiked &&
                                <button
                                    className="btn btn--primary"
                                    onClick={this.handleSave.bind(this)}
                                    type="submit"
                                    disabled={pristine || submitting}>Save</button>
                            }
                        </div>
                    }
                    { forceReadOnly && (
                        <div className="EditPlanningPanel__actions">
                            {(!agendaSpiked && !eventSpiked && !planningSpiked) &&
                            (<OverlayTrigger placement="bottom" overlay={tooltips.editTooltip}>
                                <button className="EditPlanningPanel__actions__edit" onClick={openPlanningEditor.bind(this, get(planning, '_id'))}>
                                    <i className="icon-pencil"/>
                                </button>
                            </OverlayTrigger>)}
                            <OverlayTrigger placement="bottom" overlay={tooltips.closeTooltip}>
                                <button className="EditPlanningPanel__actions__edit"
                                    onClick={closePlanningEditor.bind(null, null)}>
                                    <i className="icon-close-small"/>
                                </button>
                            </OverlayTrigger>
                        </div>)
                    }
                </header>
                <div className="EditPlanningPanel__body">
                    {agendaSpiked &&
                        <span className="AgendaSpiked label label--alert">agenda spiked</span>
                    }
                    {planningSpiked &&
                        <span className="PlanningSpiked label label--alert">planning spiked</span>
                    }
                    {eventSpiked &&
                        <span className="EventSpiked label label--alert">event spiked</span>
                    }
                    {event &&
                        <div>
                            <h3>Associated event</h3>
                            <EventMetadata event={event}/>
                        </div>
                    }
                    <h3>Planning</h3>
                    {(!creationDate || !author) &&
                        <span>Create a new planning</span>
                    }
                    <PlanningForm ref="PlanningForm" readOnly={forceReadOnly}/>
                </div>
            </div>
        )
    }
    /*eslint-enable*/
}

EditPlanningPanel.propTypes = {
    closePlanningEditor: React.PropTypes.func.isRequired,
    openPlanningEditor: React.PropTypes.func.isRequired,
    planning: React.PropTypes.object,
    event: React.PropTypes.object,
    pristine: React.PropTypes.bool.isRequired,
    submitting: React.PropTypes.bool.isRequired,
    agendaSpiked: React.PropTypes.bool,
    users: React.PropTypes.oneOfType([
        React.PropTypes.array,
        React.PropTypes.object,
    ]),
    readOnly: React.PropTypes.bool,
    unlockPrivilege: React.PropTypes.bool,
    unlockItem: React.PropTypes.func,
    lockedInThisSession: React.PropTypes.bool,
}

const mapStateToProps = (state) => ({
    planning: selectors.getCurrentPlanning(state),
    event: selectors.getCurrentPlanningEvent(state),
    agendaSpiked: selectors.getCurrentPlanningAgendaSpiked(state),
    users: selectors.getUsers(state),
    readOnly: selectors.getPlanningItemReadOnlyState(state),
    unlockPrivilege: selectors.getPrivileges(state).planning_unlock ? true : false,
    lockedInThisSession: selectors.isCurrentPlanningLockedInThisSession(state),
})

const mapDispatchToProps = (dispatch) => ({
    closePlanningEditor: (planning) => dispatch(actions.closePlanningEditor(planning)),
    openPlanningEditor: (planning) => (dispatch(actions.openPlanningEditor(planning))),
    unlockItem: (planning) => (dispatch(actions.unlockAndOpenPlanningEditor(planning))),
})

export const EditPlanningPanelContainer = connect(
    mapStateToProps, mapDispatchToProps
// connect to the form in order to have pristine and submitting in props
)(reduxForm({ form: 'planning' })(EditPlanningPanel))
