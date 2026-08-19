import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing data
  await prisma.syncJob.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.application.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();

  const password = await bcrypt.hash("password123", 12);

  // Create teams
  const opsTeam = await prisma.team.create({ data: { name: "Operations" } });
  const salesTeam = await prisma.team.create({ data: { name: "Sales" } });

  // Create users
  const admin = await prisma.user.create({
    data: {
      name: "Alex Admin",
      email: "admin@demo.com",
      password,
      role: "ADMIN",
    },
  });

  const manager1 = await prisma.user.create({
    data: {
      name: "Maria Manager",
      email: "manager@demo.com",
      password,
      role: "MANAGER",
      teamId: opsTeam.id,
    },
  });

  const exec1 = await prisma.user.create({
    data: {
      name: "Sam Executive",
      email: "exec@demo.com",
      password,
      role: "EXECUTIVE",
      teamId: opsTeam.id,
    },
  });

  const exec2 = await prisma.user.create({
    data: {
      name: "Jordan Smith",
      email: "jordan@demo.com",
      password,
      role: "EXECUTIVE",
      teamId: opsTeam.id,
    },
  });

  const exec3 = await prisma.user.create({
    data: {
      name: "Taylor Chen",
      email: "taylor@demo.com",
      password,
      role: "EXECUTIVE",
      teamId: salesTeam.id,
    },
  });

  // Set team managers
  await prisma.team.update({ where: { id: opsTeam.id }, data: { managerId: manager1.id } });

  // Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@acmecorp.com",
        company: "Acme Corp",
        phone: "+1 555-0101",
      },
    }),
    prisma.customer.create({
      data: {
        firstName: "Bob",
        lastName: "Williams",
        email: "bob@techstart.io",
        company: "TechStart Inc",
        phone: "+1 555-0102",
      },
    }),
    prisma.customer.create({
      data: {
        firstName: "Carol",
        lastName: "Davis",
        email: "carol@globetrade.com",
        company: "Globe Trade LLC",
      },
    }),
    prisma.customer.create({
      data: {
        firstName: "David",
        lastName: "Martinez",
        email: "david.m@example.com",
      },
    }),
    prisma.customer.create({
      data: {
        firstName: "Emma",
        lastName: "Brown",
        email: "emma@innovate.co",
        company: "Innovate Co",
        phone: "+1 555-0105",
      },
    }),
  ]);

  // Create applications with various statuses
  const app1 = await prisma.application.create({
    data: {
      title: "Business License Renewal",
      description: "Annual renewal of business operating license for Acme Corp. Requires verification of financials and compliance documents.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      customerId: customers[0].id,
      assignedToId: exec1.id,
      createdById: admin.id,
      teamId: opsTeam.id,
    },
  });

  const app2 = await prisma.application.create({
    data: {
      title: "Loan Application - Commercial Property",
      description: "TechStart applying for commercial property loan. Documentation includes 3 years of financials.",
      status: "UNDER_REVIEW",
      priority: "URGENT",
      customerId: customers[1].id,
      assignedToId: exec1.id,
      createdById: manager1.id,
      teamId: opsTeam.id,
    },
  });

  const app3 = await prisma.application.create({
    data: {
      title: "Import Permit Application",
      description: "Globe Trade applying for new import permits for Southeast Asia operations.",
      status: "WAITING_FOR_INFORMATION",
      priority: "MEDIUM",
      customerId: customers[2].id,
      assignedToId: exec2.id,
      createdById: manager1.id,
      teamId: opsTeam.id,
    },
  });

  const app4 = await prisma.application.create({
    data: {
      title: "Account Verification",
      description: "New account onboarding and identity verification for David Martinez.",
      status: "NEW",
      priority: "LOW",
      customerId: customers[3].id,
      createdById: admin.id,
      teamId: opsTeam.id,
    },
  });

  const app5 = await prisma.application.create({
    data: {
      title: "Partnership Agreement Processing",
      description: "Processing partnership documents between Innovate Co and our organization.",
      status: "COMPLETED",
      priority: "HIGH",
      customerId: customers[4].id,
      assignedToId: exec1.id,
      createdById: admin.id,
      teamId: opsTeam.id,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  // Create work items
  await prisma.workItem.createMany({
    data: [
      {
        title: "Collect financial statements",
        description: "Request last 3 years of audited financials",
        status: "COMPLETED",
        applicationId: app1.id,
        assignedToId: exec1.id,
        createdById: manager1.id,
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Verify compliance certificates",
        status: "IN_PROGRESS",
        applicationId: app1.id,
        assignedToId: exec1.id,
        createdById: manager1.id,
      },
      {
        title: "Schedule on-site inspection",
        status: "PENDING",
        applicationId: app1.id,
        createdById: manager1.id,
      },
      {
        title: "Review loan documentation",
        status: "COMPLETED",
        applicationId: app2.id,
        assignedToId: exec1.id,
        createdById: manager1.id,
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        title: "Credit score check",
        status: "COMPLETED",
        applicationId: app2.id,
        assignedToId: exec1.id,
        createdById: exec1.id,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Request additional documentation from Globe Trade",
        description: "Missing import licenses from previous year",
        status: "PENDING",
        applicationId: app3.id,
        assignedToId: exec2.id,
        createdById: manager1.id,
      },
    ],
  });

  // Create activity logs
  const activityData = [
    {
      applicationId: app1.id,
      userId: admin.id,
      action: "APPLICATION_CREATED",
      description: 'Application "Business License Renewal" created',
    },
    {
      applicationId: app1.id,
      userId: admin.id,
      action: "APPLICATION_ASSIGNED",
      description: "Application assigned to Sam Executive",
    },
    {
      applicationId: app1.id,
      userId: manager1.id,
      action: "STATUS_CHANGED",
      description: "Status changed from NEW to IN_PROGRESS",
      metadata: JSON.stringify({ from: "NEW", to: "IN_PROGRESS" }),
    },
    {
      applicationId: app2.id,
      userId: manager1.id,
      action: "APPLICATION_CREATED",
      description: 'Application "Loan Application - Commercial Property" created',
    },
    {
      applicationId: app2.id,
      userId: manager1.id,
      action: "STATUS_CHANGED",
      description: "Status changed from NEW to IN_PROGRESS",
    },
    {
      applicationId: app2.id,
      userId: manager1.id,
      action: "STATUS_CHANGED",
      description: "Status changed from IN_PROGRESS to UNDER_REVIEW",
    },
    {
      applicationId: app5.id,
      userId: exec1.id,
      action: "STATUS_CHANGED",
      description: "Status changed from UNDER_REVIEW to COMPLETED",
    },
    {
      applicationId: app5.id,
      userId: admin.id,
      action: "SYNC_STARTED",
      description: "Synchronization with external system started",
    },
  ];

  for (const entry of activityData) {
    await prisma.activityLog.create({ data: entry });
  }

  // Create sync job for completed application
  await prisma.syncJob.create({
    data: {
      applicationId: app5.id,
      idempotencyKey: `sync-${app5.id}`,
      status: "SUCCESS",
      attempts: 1,
      processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Seed completed!");
  console.log("\nDemo accounts:");
  console.log("  admin@demo.com / password123 (Admin)");
  console.log("  manager@demo.com / password123 (Manager)");
  console.log("  exec@demo.com / password123 (Executive)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
