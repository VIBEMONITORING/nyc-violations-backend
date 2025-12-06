class CreateBusinesses < ActiveRecord::Migration[7.1]
  def change
    create_table :businesses do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.string :address
      t.string :borough
      t.string :zip_code
      t.string :phone
      t.string :license_number
      t.integer :violations_count, default: 0, null: false

      t.timestamps
    end

    add_index :businesses, :slug, unique: true
    add_index :businesses, :license_number
    add_index :businesses, :borough
  end
end
