import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://matter:matter@postgres:5432/matter_db',
});

// Helper to generate random date within range
function randomDate(start, end) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

// Helper to add hours to date
function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

// helpers for deterministic status flow

function buildTodoFlow(createdDate, statusOptions) {
  return {
    currentStatus: statusOptions['To Do'],
    history: [{ from: null, to: statusOptions['To Do'], time: createdDate }],
  };
}

function buildInProgressFlow(createdDate, statusOptions) {
  const toDoTime = createdDate;
  const inProgressTime = addHours(toDoTime, Math.random() * 24 + 1);
  return {
    currentStatus: statusOptions['In Progress'],
    history: [
      { from: null, to: statusOptions['To Do'], time: toDoTime },
      {
        from: statusOptions['To Do'],
        to: statusOptions['In Progress'],
        time: inProgressTime,
      },
    ],
  };
}

function buildDoneFlow(createdDate, statusOptions, metOrBreached) {
  const toDoTime = createdDate;
  const inProgressTime = addHours(toDoTime, Math.random() * 4 + 0.5);

  const resolutionHours =
    metOrBreached === 'met'
      ? Math.random() * 7 + 1 // 1–8 hrs
      : Math.random() * 16 + 8; // 8–24 hrs

  const doneTime = addHours(toDoTime, resolutionHours);

  return {
    currentStatus: statusOptions['Done'],
    history: [
      { from: null, to: statusOptions['To Do'], time: toDoTime },
      {
        from: statusOptions['To Do'],
        to: statusOptions['In Progress'],
        time: inProgressTime,
      },
      {
        from: statusOptions['In Progress'],
        to: statusOptions['Done'],
        time: doneTime,
      },
    ],
  };
}

function getStatusFlow(statusType, createdDate, statusOptions) {
  switch (statusType) {
    case 'todo':
      return buildTodoFlow(createdDate, statusOptions);

    case 'inProgress':
      return buildInProgressFlow(createdDate, statusOptions);

    case 'met':
      return buildDoneFlow(createdDate, statusOptions, 'met');

    case 'breached':
      return buildDoneFlow(createdDate, statusOptions, 'breached');

    default:
      throw new Error('Unknown status type: ' + statusType);
  }
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Starting seed process...');

    // Create account
    console.log('Creating account...');
    const accountResult = await client.query(
      `INSERT INTO accounts (account_name) VALUES ('Demo Account') RETURNING account_id`
    );
    const accountId = accountResult.rows[0].account_id;

    // Create users
    console.log('Creating users...');
    const userIds = [];
    const userNames = [
      { first: 'John', last: 'Doe', email: 'john.doe@example.com' },
      { first: 'BJ', last: 'Blazkowicz', email: 'bjblazkowicz@example.com' },
      { first: 'Jane', last: 'Smith', email: 'jane.smith@example.com' },
      { first: 'Mike', last: 'Johnson', email: 'mike.johnson@example.com' },
      { first: 'Sarah', last: 'Williams', email: 'sarah.williams@example.com' },
      { first: 'David', last: 'Brown', email: 'david.brown@example.com' },
    ];

    for (const user of userNames) {
      const result = await client.query(
        `INSERT INTO users (account_id, email, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id`,
        [accountId, user.email, user.first, user.last]
      );
      userIds.push(result.rows[0].id);
    }

    const defaultUserId = userIds[0];

    // Create board
    console.log('Creating board...');
    const boardResult = await client.query(
      `INSERT INTO ticketing_board (account_id, name) VALUES ($1, 'Legal Matters') RETURNING id`,
      [accountId]
    );
    const boardId = boardResult.rows[0].id;

    // Create status groups
    console.log('Creating status groups...');
    const statusGroups = {};
    const groupNames = ['To Do', 'In Progress', 'Done'];

    for (let i = 0; i < groupNames.length; i++) {
      const result = await client.query(
        `INSERT INTO ticketing_field_status_groups (account_id, name, sequence, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [accountId, groupNames[i], i + 1, defaultUserId, defaultUserId]
      );
      statusGroups[groupNames[i]] = result.rows[0].id;
    }

    // Create currency options
    console.log('Creating currency options...');
    const currencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    ];

    for (let i = 0; i < currencies.length; i++) {
      await client.query(
        `INSERT INTO ticketing_currency_field_options (account_id, code, name, symbol, sequence) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          accountId,
          currencies[i].code,
          currencies[i].name,
          currencies[i].symbol,
          i + 1,
        ]
      );
    }

    // Create fields
    console.log('Creating fields...');
    const fields = {};

    // Text field - Matter Subject
    const subjectField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, system_field, created_by, updated_by) 
       VALUES ($1, 'subject', 'text', true, $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.subject = subjectField.rows[0].id;

    // Text field - Description
    const descField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Description', 'text', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.description = descField.rows[0].id;

    // Number field - Case Number
    const caseNumField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Case Number', 'number', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.caseNumber = caseNumField.rows[0].id;

    // User field - Assigned To
    const assignedField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Assigned To', 'user', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.assignedTo = assignedField.rows[0].id;

    // Currency field - Contract Value
    const currencyField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Contract Value', 'currency', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.contractValue = currencyField.rows[0].id;

    // Boolean field - Urgent
    const urgentField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Urgent', 'boolean', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.urgent = urgentField.rows[0].id;

    // Date field - Due Date
    const dueDateField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Due Date', 'date', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.dueDate = dueDateField.rows[0].id;

    // Select field - Priority
    const priorityField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, created_by, updated_by) 
       VALUES ($1, 'Priority', 'select', $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.priority = priorityField.rows[0].id;

    // Priority options
    const priorities = ['Low', 'Medium', 'High', 'Critical'];
    const priorityOptions = {};
    for (let i = 0; i < priorities.length; i++) {
      const result = await client.query(
        `INSERT INTO ticketing_field_options (ticket_field_id, label, sequence, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [fields.priority, priorities[i], i + 1, defaultUserId, defaultUserId]
      );
      priorityOptions[priorities[i]] = result.rows[0].id;
    }

    // Status field
    const statusField = await client.query(
      `INSERT INTO ticketing_fields (account_id, name, field_type, system_field, created_by, updated_by) 
       VALUES ($1, 'Status', 'status', true, $2, $3) RETURNING id`,
      [accountId, defaultUserId, defaultUserId]
    );
    fields.status = statusField.rows[0].id;

    // Status options
    const statusOptions = {};
    const statuses = [
      { label: 'To Do', group: 'To Do' },
      { label: 'In Progress', group: 'In Progress' },
      { label: 'Done', group: 'Done' },
    ];

    for (let i = 0; i < statuses.length; i++) {
      const result = await client.query(
        `INSERT INTO ticketing_field_status_options (ticket_field_id, group_id, label, sequence, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          fields.status,
          statusGroups[statuses[i].group],
          statuses[i].label,
          i + 1,
          defaultUserId,
          defaultUserId,
        ]
      );
      statusOptions[statuses[i].label] = result.rows[0].id;
    }

    const startDate = new Date('2023-01-01');
    const endDate = new Date('2024-12-31');

    const statusOrder = ['todo', 'inProgress', 'met', 'breached'];

    //  BJ Blaowsokwiz - compliance - low

    for (let i = 0; i < 4; i++) {
      // Create ticket
      const ticketResult = await client.query(
        `INSERT INTO ticketing_ticket (board_id) VALUES ($1) RETURNING id`,
        [boardId]
      );
      const ticketId = ticketResult.rows[0].id;

      // Compliance matters
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.subject,
          'Compliance Matter',
          defaultUserId,
          defaultUserId,
        ]
      );

      // Description
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.description,
          'This is a compliance requiring attention and review',
          defaultUserId,
          defaultUserId,
        ]
      );

      // Case Number
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, number_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.caseNumber, 202500 + i, defaultUserId, defaultUserId]
      );

      const assignedUserId = userIds[1];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, user_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.assignedTo,
          assignedUserId,
          defaultUserId,
          defaultUserId,
        ]
      );

      // Contract Value
      const amount = Math.floor(Math.random() * 1000000) + 10000;
      const currency =
        currencies[Math.floor(Math.random() * currencies.length)].code;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, currency_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.contractValue,
          JSON.stringify({ amount, currency }),
          defaultUserId,
          defaultUserId,
        ]
      );

      // Urgent (30% chance)
      const isUrgent = Math.random() < 0.3;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, boolean_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.urgent, isUrgent, defaultUserId, defaultUserId]
      );

      // Due Date
      const dueDate = randomDate(new Date(), addHours(new Date(), 720)); // Within next 30 days
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, date_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.dueDate, dueDate, defaultUserId, defaultUserId]
      );

      // Priority - Low
      const priorityOption = Object.values(priorityOptions)[0];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, select_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.priority,
          priorityOption,
          defaultUserId,
          defaultUserId,
        ]
      );

      //   1 todo, 1 in progress, 1 met, 1 breached
      const statusType = statusOrder[i % 4];
      const createdDate = randomDate(startDate, endDate);

      const { currentStatus, history } = getStatusFlow(
        statusType,
        createdDate,
        statusOptions
      );
      // Insert status
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, status_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.status, currentStatus, defaultUserId, defaultUserId]
      );

      // Insert cycle time history
      for (const transition of history) {
        await client.query(
          `INSERT INTO ticketing_cycle_time_histories (ticket_id, status_field_id, from_status_id, to_status_id, transitioned_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            ticketId,
            fields.status,
            transition.from,
            transition.to,
            transition.time,
          ]
        );
      }
    }

    // Jane Smith - Merger - Medium
    for (let i = 4; i < 8; i++) {
      // Create ticket
      const ticketResult = await client.query(
        `INSERT INTO ticketing_ticket (board_id) VALUES ($1) RETURNING id`,
        [boardId]
      );
      const ticketId = ticketResult.rows[0].id;

      // Compliance matters
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.subject,
          'Merger Matter',
          defaultUserId,
          defaultUserId,
        ]
      );

      // Description
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.description,
          'This is a merger requiring attention and review',
          defaultUserId,
          defaultUserId,
        ]
      );

      // Case Number
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, number_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.caseNumber, 202500 + i, defaultUserId, defaultUserId]
      );

      const assignedUserId = userIds[2];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, user_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.assignedTo,
          assignedUserId,
          defaultUserId,
          defaultUserId,
        ]
      );

      // Contract Value
      const amount = Math.floor(Math.random() * 1000000) + 10000;
      const currency =
        currencies[Math.floor(Math.random() * currencies.length)].code;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, currency_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.contractValue,
          JSON.stringify({ amount, currency }),
          defaultUserId,
          defaultUserId,
        ]
      );

      // Urgent (30% chance)
      const isUrgent = Math.random() < 0.3;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, boolean_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.urgent, isUrgent, defaultUserId, defaultUserId]
      );

      // Due Date
      const dueDate = randomDate(new Date(), addHours(new Date(), 720)); // Within next 30 days
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, date_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.dueDate, dueDate, defaultUserId, defaultUserId]
      );

      // Priority - Medium
      const priorityOption = Object.values(priorityOptions)[1];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, select_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.priority,
          priorityOption,
          defaultUserId,
          defaultUserId,
        ]
      );

      //   1 todo, 1 in progress, 1 met, 1 breached
      const statusType = statusOrder[i % 4];
      const createdDate = randomDate(startDate, endDate);

      const { currentStatus, history } = getStatusFlow(
        statusType,
        createdDate,
        statusOptions
      );
      // Insert status
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, status_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.status, currentStatus, defaultUserId, defaultUserId]
      );

      // Insert cycle time history
      for (const transition of history) {
        await client.query(
          `INSERT INTO ticketing_cycle_time_histories (ticket_id, status_field_id, from_status_id, to_status_id, transitioned_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            ticketId,
            fields.status,
            transition.from,
            transition.to,
            transition.time,
          ]
        );
      }
    }

    // Mike Johnson - High
    for (let i = 8; i < 12; i++) {
      // Create ticket
      const ticketResult = await client.query(
        `INSERT INTO ticketing_ticket (board_id) VALUES ($1) RETURNING id`,
        [boardId]
      );
      const ticketId = ticketResult.rows[0].id;

      // Compliance matters
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.subject, 'Legal Matter', defaultUserId, defaultUserId]
      );

      // Description
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.description,
          'This is a Legal requiring attention and review',
          defaultUserId,
          defaultUserId,
        ]
      );

      // Case Number
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, number_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.caseNumber, 202500 + i, defaultUserId, defaultUserId]
      );

      const assignedUserId = userIds[3];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, user_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.assignedTo,
          assignedUserId,
          defaultUserId,
          defaultUserId,
        ]
      );

      // Contract Value
      const amount = Math.floor(Math.random() * 1000000) + 10000;
      const currency =
        currencies[Math.floor(Math.random() * currencies.length)].code;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, currency_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.contractValue,
          JSON.stringify({ amount, currency }),
          defaultUserId,
          defaultUserId,
        ]
      );

      // Urgent (30% chance)
      const isUrgent = Math.random() < 0.3;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, boolean_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.urgent, isUrgent, defaultUserId, defaultUserId]
      );

      // Due Date
      const dueDate = randomDate(new Date(), addHours(new Date(), 720)); // Within next 30 days
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, date_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.dueDate, dueDate, defaultUserId, defaultUserId]
      );

      // Priority - High
      const priorityOption = Object.values(priorityOptions)[2];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, select_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.priority,
          priorityOption,
          defaultUserId,
          defaultUserId,
        ]
      );

      //   1 todo, 1 in progress, 1 met, 1 breached
      const statusType = statusOrder[i % 4];
      const createdDate = randomDate(startDate, endDate);

      const { currentStatus, history } = getStatusFlow(
        statusType,
        createdDate,
        statusOptions
      );
      // Insert status
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, status_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.status, currentStatus, defaultUserId, defaultUserId]
      );

      // Insert cycle time history
      for (const transition of history) {
        await client.query(
          `INSERT INTO ticketing_cycle_time_histories (ticket_id, status_field_id, from_status_id, to_status_id, transitioned_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            ticketId,
            fields.status,
            transition.from,
            transition.to,
            transition.time,
          ]
        );
      }
    }

    // Sarah Williams - critical
    for (let i = 12; i < 16; i++) {
      // Create ticket
      const ticketResult = await client.query(
        `INSERT INTO ticketing_ticket (board_id) VALUES ($1) RETURNING id`,
        [boardId]
      );
      const ticketId = ticketResult.rows[0].id;

      // Compliance matters
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.subject, 'Beer Matter', defaultUserId, defaultUserId]
      );

      // Description
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, text_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.description,
          'This is a Beer requiring attention and review',
          defaultUserId,
          defaultUserId,
        ]
      );

      // Case Number
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, number_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.caseNumber, 202500 + i, defaultUserId, defaultUserId]
      );

      const assignedUserId = userIds[4];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, user_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.assignedTo,
          assignedUserId,
          defaultUserId,
          defaultUserId,
        ]
      );

      // Contract Value
      const amount = Math.floor(Math.random() * 1000000) + 10000;
      const currency =
        currencies[Math.floor(Math.random() * currencies.length)].code;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, currency_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.contractValue,
          JSON.stringify({ amount, currency }),
          defaultUserId,
          defaultUserId,
        ]
      );

      // Urgent (30% chance)
      const isUrgent = Math.random() < 0.3;
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, boolean_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.urgent, isUrgent, defaultUserId, defaultUserId]
      );

      // Due Date
      const dueDate = randomDate(new Date(), addHours(new Date(), 720)); // Within next 30 days
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, date_value, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.dueDate, dueDate, defaultUserId, defaultUserId]
      );

      // Priority - Critical
      const priorityOption = Object.values(priorityOptions)[3];
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, select_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          fields.priority,
          priorityOption,
          defaultUserId,
          defaultUserId,
        ]
      );

      //   1 todo, 1 in progress, 1 met, 1 breached
      const statusType = statusOrder[i % 4];
      const createdDate = randomDate(startDate, endDate);

      const { currentStatus, history } = getStatusFlow(
        statusType,
        createdDate,
        statusOptions
      );
      // Insert status
      await client.query(
        `INSERT INTO ticketing_ticket_field_value (ticket_id, ticket_field_id, status_reference_value_uuid, created_by, updated_by) 
         VALUES ($1, $2, $3, $4, $5)`,
        [ticketId, fields.status, currentStatus, defaultUserId, defaultUserId]
      );

      // Insert cycle time history
      for (const transition of history) {
        await client.query(
          `INSERT INTO ticketing_cycle_time_histories (ticket_id, status_field_id, from_status_id, to_status_id, transitioned_at) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            ticketId,
            fields.status,
            transition.from,
            transition.to,
            transition.time,
          ]
        );
      }
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
