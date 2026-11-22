CREATE DATABASE IF NOT EXISTS smart_office
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smart_office;

DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS resources;

CREATE TABLE resources (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    type ENUM('desk', 'room') NOT NULL,
    capacity INT NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reservations (
    id INT NOT NULL AUTO_INCREMENT,
    resource_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_reservations_resource
        FOREIGN KEY (resource_id) REFERENCES resources (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO resources (name, type, capacity) VALUES
('Biurko 1', 'desk', 1),
('Biurko 2', 'desk', 1),
('Biurko 3', 'desk', 1),
('Biurko 4', 'desk', 1),
('Biurko 5', 'desk', 1),
('Biurko 6', 'desk', 1),
('Sala A', 'room', 8),
('Sala B', 'room', 14);

INSERT INTO reservations (resource_id, user_name, start_time, end_time) VALUES
(1, 'Jan Kowalski', CONCAT(CURDATE(), ' 08:00:00'), CONCAT(CURDATE(), ' 12:00:00')),
(2, 'Anna Nowak', CONCAT(CURDATE(), ' 10:00:00'), CONCAT(CURDATE(), ' 13:00:00')),
(7, 'Zespol IT', CONCAT(CURDATE(), ' 09:00:00'), CONCAT(CURDATE(), ' 11:00:00')),
(8, 'Spotkanie projektu', CONCAT(CURDATE(), ' 13:00:00'), CONCAT(CURDATE(), ' 15:00:00'));
