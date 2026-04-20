import { AgentWorkflow, WorkflowContext, WorkflowResult } from '../interfaces/workflow';

/**
 * A basic implementation of an appointment booking workflow.
 * This demonstrates how to handle stateful flows (date -> time -> confirm).
 */
export class BookingWorkflow implements AgentWorkflow {
    name = 'Appointment Booking';
    description = 'Handles clinic or hospital appointment scheduling.';
    triggerIntents = ['book_appointment', 'schedule_visit', 'see_doctor'];

    async execute(input: string, context: WorkflowContext): Promise<WorkflowResult> {
        const state = context.state || {};
        
        if (!state.bookingStep) {
            state.bookingStep = 'get_date';
            return {
                nextMessage: "Sure, what date would you like to come in?",
                stateUpdates: state
            };
        }

        if (state.bookingStep === 'get_date') {
            state.date = input; // Simplification: in real usage, use LLM to parse date
            state.bookingStep = 'get_time';
            return {
                nextMessage: `Great, I have you down for ${input}. What time works best for you?`,
                stateUpdates: state
            };
        }

        if (state.bookingStep === 'get_time') {
            state.time = input;
            state.bookingStep = 'confirm';
            return {
                nextMessage: `Perfect. So that's an appointment on ${state.date} at ${input}. Shall I confirm this for you?`,
                stateUpdates: state
            };
        }

        if (state.bookingStep === 'confirm') {
            if (input.toLowerCase().includes('yes') || input.toLowerCase().includes('confirm')) {
                state.bookingStep = 'complete';
                return {
                    nextMessage: "Your appointment has been successfully booked. We'll see you then!",
                    isComplete: true,
                    stateUpdates: state
                };
            } else {
                return {
                    nextMessage: "No problem. Let me know if you'd like to change the date or time.",
                    stateUpdates: state
                };
            }
        }

        return { nextMessage: "I'm sorry, I'm not sure how to proceed with the booking." };
    }
}
