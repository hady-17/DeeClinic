

export interface IRepository<T> {
    /**
     * Creates a new item in the repository.
     * @param item The item to create.
     * @returns A promise that resolves to the ID of the created item.
     * @throws {InvalidItemException} An error if the creation fails.
     * @throws {DBexception}an error if db connection fails.
     */
    create(item: T): Promise<string>;
    /**
     * Retrieves an item by its ID.
     * @param id The ID of the item to retrieve.
     * @returns A promise that resolves to the item if found, or null if not found.
     * @throws {ItemNotFoundException} An error if the item is not found.
     * @throws {DBexception} An error if db connection fails.
     */
    getById(id: string): Promise<T>;
    /**
     * Retrieves all items in the repository.
     * @returns A promise that resolves to an array of all items.
     * @throws {DBexception} An error if db connection fails.
     */
    getAll(): Promise<T[]>;
    /**
     * Updates an existing item in the repository.
     * @param id The ID of the item to update.
     * @param item The updated item data (partial).
     * @returns A promise that resolves to the updated item if successful, or null if the item is not found.
     * @throws {ItemNotFoundException} An error if the item to update is not found.
     * @throws {InvalidItemException} An error if the update fails due to invalid data.
     * @throws {DBexception} An error if db connection fails.
     */
    update(id: string, item: Partial<Omit<T, "id">>): Promise<void>;
    /**
     * Deletes an item from the repository.
     * @param id The ID of the item to delete.
     * @return A promise that resolves to true if the item was successfully deleted, or false if the item was not found.
     * @throws {ItemNotFoundException} An error if the item to delete is not found.
     * @throws {DBexception} An error if db connection fails.
     */
    delete(id: string): Promise<void>;
}