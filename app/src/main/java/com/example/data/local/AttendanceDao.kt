package com.example.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {
    // Branches
    @Query("SELECT * FROM branches ORDER BY name ASC")
    fun getAllBranches(): Flow<List<BranchEntity>>

    @Query("SELECT * FROM branches WHERE id = :id LIMIT 1")
    suspend fun getBranchById(id: Long): BranchEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBranches(branches: List<BranchEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBranch(branch: BranchEntity): Long

    @Update
    suspend fun updateBranch(branch: BranchEntity)

    @Query("DELETE FROM branches WHERE id = :id")
    suspend fun deleteBranchById(id: Long)

    // Employees
    @Query("SELECT * FROM employees ORDER BY id ASC")
    fun getAllEmployees(): Flow<List<EmployeeEntity>>

    @Query("SELECT * FROM employees WHERE id = :id LIMIT 1")
    suspend fun getEmployeeById(id: Long): EmployeeEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEmployees(employees: List<EmployeeEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEmployee(employee: EmployeeEntity): Long

    @Update
    suspend fun updateEmployee(employee: EmployeeEntity)

    @Query("DELETE FROM employees WHERE id = :id")
    suspend fun deleteEmployeeById(id: Long)

    // Attendance Records
    @Query("SELECT * FROM attendance_records ORDER BY timestamp DESC")
    fun getAllAttendanceRecords(): Flow<List<AttendanceRecordEntity>>

    @Query("SELECT * FROM attendance_records WHERE employeeId = :employeeId ORDER BY timestamp DESC")
    fun getRecordsForEmployee(employeeId: Long): Flow<List<AttendanceRecordEntity>>

    @Query("SELECT * FROM attendance_records WHERE employeeId = :employeeId ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastRecordForEmployee(employeeId: Long): AttendanceRecordEntity?

    @Query("SELECT * FROM attendance_records WHERE formattedDate = :date ORDER BY timestamp DESC")
    fun getRecordsForDate(date: String): Flow<List<AttendanceRecordEntity>>

    @Query("SELECT * FROM attendance_records WHERE timestamp >= :startTime AND timestamp <= :endTime ORDER BY timestamp DESC")
    fun getRecordsBetweenTimestamps(startTime: Long, endTime: Long): Flow<List<AttendanceRecordEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendanceRecord(record: AttendanceRecordEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendanceRecords(records: List<AttendanceRecordEntity>)

    @Query("SELECT * FROM attendance_records WHERE id = :id LIMIT 1")
    suspend fun getRecordById(id: Long): AttendanceRecordEntity?

    // Geç giriş gerekçesi (personel giriş sonrası beyan eder)
    @Query("UPDATE attendance_records SET lateReasonCode = :code, lateReasonNote = :note WHERE id = :id")
    suspend fun updateLateReason(id: Long, code: String, note: String)

    // Security Alerts
    @Query("SELECT * FROM security_alerts ORDER BY timestamp DESC")
    fun getAllSecurityAlerts(): Flow<List<SecurityAlertEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSecurityAlert(alert: SecurityAlertEntity): Long

    // Notifications
    @Query("SELECT * FROM notifications ORDER BY timestamp DESC")
    fun getAllNotifications(): Flow<List<NotificationEntity>>

    @Query("SELECT COUNT(*) FROM notifications WHERE isRead = 0")
    fun getUnreadNotificationsCount(): Flow<Int>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNotification(notification: NotificationEntity): Long

    @Query("UPDATE notifications SET isRead = 1 WHERE id = :id")
    suspend fun markNotificationAsRead(id: Long)

    @Query("UPDATE notifications SET isRead = 1")
    suspend fun markAllNotificationsAsRead()

    @Query("DELETE FROM notifications")
    suspend fun clearAllNotifications()
}
