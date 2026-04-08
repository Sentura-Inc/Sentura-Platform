import fs from "node:fs/promises";
import path from "node:path";
import type { Department, SenturaRole, SenturaUser } from "./types.js";

export class RbacStore {
  private dataDir: string;
  private users: Map<string, SenturaUser> = new Map();
  private departments: Map<string, Department> = new Map();
  private loaded = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadUsers();
    await this.loadDepartments();
    this.loaded = true;
  }

  // --- Users ---

  async getUser(userId: string): Promise<SenturaUser | undefined> {
    await this.ensureLoaded();
    return this.users.get(userId);
  }

  async getUserByEmail(email: string): Promise<SenturaUser | undefined> {
    await this.ensureLoaded();
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async listUsers(): Promise<SenturaUser[]> {
    await this.ensureLoaded();
    return Array.from(this.users.values());
  }

  async listUsersByDepartment(departmentId: string): Promise<SenturaUser[]> {
    await this.ensureLoaded();
    const dept = this.departments.get(departmentId);
    if (!dept) return [];
    return Array.from(this.users.values()).filter(
      (u) => u.departmentIds.includes(departmentId) || dept.adminUserIds.includes(u.id),
    );
  }

  async upsertUser(user: SenturaUser): Promise<void> {
    await this.ensureLoaded();
    user.updatedAt = new Date().toISOString();
    this.users.set(user.id, user);
    await this.persistUsers();
  }

  async deleteUser(userId: string): Promise<boolean> {
    await this.ensureLoaded();
    const existed = this.users.delete(userId);
    if (existed) await this.persistUsers();
    return existed;
  }

  async assignRole(userId: string, role: SenturaRole): Promise<boolean> {
    await this.ensureLoaded();
    const user = this.users.get(userId);
    if (!user) return false;
    user.role = role;
    user.updatedAt = new Date().toISOString();
    await this.persistUsers();
    return true;
  }

  // --- Departments ---

  async getDepartment(departmentId: string): Promise<Department | undefined> {
    await this.ensureLoaded();
    return this.departments.get(departmentId);
  }

  async listDepartments(): Promise<Department[]> {
    await this.ensureLoaded();
    return Array.from(this.departments.values());
  }

  async upsertDepartment(dept: Department): Promise<void> {
    await this.ensureLoaded();
    dept.updatedAt = new Date().toISOString();
    this.departments.set(dept.id, dept);
    await this.persistDepartments();
  }

  async deleteDepartment(departmentId: string): Promise<boolean> {
    await this.ensureLoaded();
    const existed = this.departments.delete(departmentId);
    if (existed) await this.persistDepartments();
    return existed;
  }

  async getDepartmentsForUser(userId: string): Promise<Department[]> {
    await this.ensureLoaded();
    const user = this.users.get(userId);
    if (!user) return [];
    return user.departmentIds
      .map((id) => this.departments.get(id))
      .filter((d): d is Department => d !== undefined);
  }

  async getEmployeeIdsVisibleToUser(userId: string): Promise<string[] | "all"> {
    await this.ensureLoaded();
    const user = this.users.get(userId);
    if (!user) return [];

    if (user.role === "platform_admin" || user.role === "auditor") {
      return "all";
    }

    if (user.role === "dept_admin") {
      const departments = await this.getDepartmentsForUser(userId);
      const ids = new Set<string>();
      for (const dept of departments) {
        for (const empId of dept.employeeIds) ids.add(empId);
        await this.collectChildDepartmentEmployees(dept.id, ids);
      }
      return Array.from(ids);
    }

    if (user.role === "employee_owner") {
      return [...user.ownedEmployeeIds];
    }

    return [];
  }

  // --- Private ---

  private async collectChildDepartmentEmployees(parentId: string, ids: Set<string>): Promise<void> {
    for (const dept of this.departments.values()) {
      if (dept.parentId === parentId) {
        for (const empId of dept.employeeIds) ids.add(empId);
        await this.collectChildDepartmentEmployees(dept.id, ids);
      }
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.initialize();
  }

  private usersPath(): string {
    return path.join(this.dataDir, "users.json");
  }

  private departmentsPath(): string {
    return path.join(this.dataDir, "departments.json");
  }

  private async loadUsers(): Promise<void> {
    try {
      const raw = await fs.readFile(this.usersPath(), "utf-8");
      const arr = JSON.parse(raw) as SenturaUser[];
      this.users = new Map(arr.map((u) => [u.id, u]));
    } catch {
      this.users = new Map();
    }
  }

  private async loadDepartments(): Promise<void> {
    try {
      const raw = await fs.readFile(this.departmentsPath(), "utf-8");
      const arr = JSON.parse(raw) as Department[];
      this.departments = new Map(arr.map((d) => [d.id, d]));
    } catch {
      this.departments = new Map();
    }
  }

  private async persistUsers(): Promise<void> {
    const arr = Array.from(this.users.values());
    await fs.writeFile(this.usersPath(), JSON.stringify(arr, null, 2), "utf-8");
  }

  private async persistDepartments(): Promise<void> {
    const arr = Array.from(this.departments.values());
    await fs.writeFile(this.departmentsPath(), JSON.stringify(arr, null, 2), "utf-8");
  }
}
