
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "academic_sessions": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": number,"is_current": boolean,"name": string,"starts_on": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: never,"is_current"?: boolean,"name": string,"starts_on": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: never,"is_current"?: boolean,"name"?: string,"starts_on"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"admission_applications": {
                  Row: {
                    "birth_date": string,"birth_reg_no": string,"blood_group": Database["public"]['Enums']["blood_group"] | null,"class_id": number,"father_name": string,"gender": Database["public"]['Enums']["gender"],"group_id": number | null,"guardian_email": string | null,"guardian_occupation": string,"guardian_phone": string,"id": number,"last_result": string,"local_guardian_name": string,"mother_name": string,"office_note": string,"permanent_address": string,"photo_path": string | null,"present_address": string,"previous_school": string,"religion": Database["public"]['Enums']["religion"] | null,"session_id": number,"status": Database["public"]['Enums']["admission_status"],"student_id": number | null,"student_name_bn": string,"student_name_en": string,"submitted_at": string,"test_at": string | null,"test_marks": number | null,"test_venue": string,"tracking_no": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date": string,"birth_reg_no": string,"blood_group"?: Database["public"]['Enums']["blood_group"] | null,"class_id": number,"father_name": string,"gender": Database["public"]['Enums']["gender"],"group_id"?: number | null,"guardian_email"?: string | null,"guardian_occupation"?: string,"guardian_phone": string,"id"?: never,"last_result"?: string,"local_guardian_name"?: string,"mother_name": string,"office_note"?: string,"permanent_address"?: string,"photo_path"?: string | null,"present_address": string,"previous_school"?: string,"religion"?: Database["public"]['Enums']["religion"] | null,"session_id": number,"status"?: Database["public"]['Enums']["admission_status"],"student_id"?: number | null,"student_name_bn"?: string,"student_name_en": string,"submitted_at"?: string,"test_at"?: string | null,"test_marks"?: number | null,"test_venue"?: string,"tracking_no": string,"updated_at"?: string
                  }
                  Update: {
                    "birth_date"?: string,"birth_reg_no"?: string,"blood_group"?: Database["public"]['Enums']["blood_group"] | null,"class_id"?: number,"father_name"?: string,"gender"?: Database["public"]['Enums']["gender"],"group_id"?: number | null,"guardian_email"?: string | null,"guardian_occupation"?: string,"guardian_phone"?: string,"id"?: never,"last_result"?: string,"local_guardian_name"?: string,"mother_name"?: string,"office_note"?: string,"permanent_address"?: string,"photo_path"?: string | null,"present_address"?: string,"previous_school"?: string,"religion"?: Database["public"]['Enums']["religion"] | null,"session_id"?: number,"status"?: Database["public"]['Enums']["admission_status"],"student_id"?: number | null,"student_name_bn"?: string,"student_name_en"?: string,"submitted_at"?: string,"test_at"?: string | null,"test_marks"?: number | null,"test_venue"?: string,"tracking_no"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admission_applications_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_applications_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_applications_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "admission_applications_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"admission_documents": {
                  Row: {
                    "application_id": number,"created_at": string,"file_path": string,"file_size": number,"id": number,"kind": string,"mime_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "application_id": number,"created_at"?: string,"file_path": string,"file_size": number,"id"?: never,"kind": string,"mime_type": string
                  }
                  Update: {
                    "application_id"?: number,"created_at"?: string,"file_path"?: string,"file_size"?: number,"id"?: never,"kind"?: string,"mime_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admission_documents_application_id_fkey"
      columns: ["application_id"]
isOneToOne: false
      referencedRelation: "admission_applications"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "created_at": string,"date": string,"id": number,"marked_by": string | null,"note": string,"section_id": number,"status": Database["public"]['Enums']["attendance_status"],"student_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: never,"marked_by"?: string | null,"note"?: string,"section_id": number,"status": Database["public"]['Enums']["attendance_status"],"student_id": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: never,"marked_by"?: string | null,"note"?: string,"section_id"?: number,"status"?: Database["public"]['Enums']["attendance_status"],"student_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_marked_by_fkey"
      columns: ["marked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"entity": string,"entity_id": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity": string,"entity_id": string,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"board_results": {
                  Row: {
                    "created_at": string,"exam": string,"examinees": number,"gpa5": number,"id": number,"passed": number,"updated_at": string,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exam"?: string,"examinees": number,"gpa5"?: number,"id"?: never,"passed": number,"updated_at"?: string,"year": number
                  }
                  Update: {
                    "created_at"?: string,"exam"?: string,"examinees"?: number,"gpa5"?: number,"id"?: never,"passed"?: number,"updated_at"?: string,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "body_bn": string,"body_en": string,"created_at": string,"id": number,"issued_by": string | null,"issued_on": string,"reference": string,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"student_id": number | null,"student_name_bn": string,"student_name_en": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_bn"?: string,"body_en": string,"created_at"?: string,"id"?: never,"issued_by"?: string | null,"issued_on"?: string,"reference": string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"student_id"?: number | null,"student_name_bn"?: string,"student_name_en": string,"type": string
                  }
                  Update: {
                    "body_bn"?: string,"body_en"?: string,"created_at"?: string,"id"?: never,"issued_by"?: string | null,"issued_on"?: string,"reference"?: string,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"student_id"?: number | null,"student_name_bn"?: string,"student_name_en"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_issued_by_fkey"
      columns: ["issued_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"class_subjects": {
                  Row: {
                    "class_id": number,"created_at": string,"group_id": number | null,"id": number,"subject_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": number,"created_at"?: string,"group_id"?: number | null,"id"?: never,"subject_id": number
                  }
                  Update: {
                    "class_id"?: number,"created_at"?: string,"group_id"?: number | null,"id"?: never,"subject_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_subjects_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subjects_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_subjects_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"classes": {
                  Row: {
                    "created_at": string,"id": number,"level": number,"name_bn": string,"name_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"level": number,"name_bn"?: string,"name_en": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"level"?: number,"name_bn"?: string,"name_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"contact_messages": {
                  Row: {
                    "created_at": string,"email": string,"id": number,"is_read": boolean,"message": string,"name": string,"phone": string,"read_at": string | null,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string,"id"?: never,"is_read"?: boolean,"message": string,"name": string,"phone": string,"read_at"?: string | null,"subject": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: never,"is_read"?: boolean,"message"?: string,"name"?: string,"phone"?: string,"read_at"?: string | null,"subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"designations": {
                  Row: {
                    "created_at": string,"id": number,"is_teaching": boolean,"name_bn": string,"name_en": string,"rank": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"is_teaching"?: boolean,"name_bn"?: string,"name_en": string,"rank": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"is_teaching"?: boolean,"name_bn"?: string,"name_en"?: string,"rank"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"downloads": {
                  Row: {
                    "category": string,"created_at": string,"file_path": string | null,"file_size": number | null,"id": number,"is_published": boolean,"mime_type": string | null,"published_at": string | null,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"created_at"?: string,"file_path"?: string | null,"file_size"?: number | null,"id"?: never,"is_published"?: boolean,"mime_type"?: string | null,"published_at"?: string | null,"title_bn"?: string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"file_path"?: string | null,"file_size"?: number | null,"id"?: never,"is_published"?: boolean,"mime_type"?: string | null,"published_at"?: string | null,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enrollments": {
                  Row: {
                    "created_at": string,"fourth_subject_id": number | null,"group_id": number | null,"id": number,"roll": number,"section_id": number,"session_id": number,"student_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fourth_subject_id"?: number | null,"group_id"?: number | null,"id"?: never,"roll": number,"section_id": number,"session_id": number,"student_id": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"fourth_subject_id"?: number | null,"group_id"?: number | null,"id"?: never,"roll"?: number,"section_id"?: number,"session_id"?: number,"student_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_fourth_subject_id_fkey"
      columns: ["fourth_subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "album_id": number | null,"body_bn": string,"body_en": string,"cover_path": string | null,"created_at": string,"created_by": string | null,"ends_at": string | null,"id": number,"is_published": boolean,"published_at": string | null,"slug": string,"starts_at": string,"title_bn": string,"title_en": string,"updated_at": string,"venue_bn": string,"venue_en": string
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id"?: number | null,"body_bn"?: string,"body_en"?: string,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"slug": string,"starts_at": string,"title_bn"?: string,"title_en": string,"updated_at"?: string,"venue_bn"?: string,"venue_en"?: string
                  }
                  Update: {
                    "album_id"?: number | null,"body_bn"?: string,"body_en"?: string,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"slug"?: string,"starts_at"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string,"venue_bn"?: string,"venue_en"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "gallery_albums"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ex_principals": {
                  Row: {
                    "created_at": string,"from_year": number,"full_name_bn": string,"full_name_en": string,"id": number,"note_bn": string,"note_en": string,"photo_path": string | null,"to_year": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_year": number,"full_name_bn"?: string,"full_name_en": string,"id"?: never,"note_bn"?: string,"note_en"?: string,"photo_path"?: string | null,"to_year": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"from_year"?: number,"full_name_bn"?: string,"full_name_en"?: string,"id"?: never,"note_bn"?: string,"note_en"?: string,"photo_path"?: string | null,"to_year"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exam_classes": {
                  Row: {
                    "class_id": number,"exam_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": number,"exam_id": number
                  }
                  Update: {
                    "class_id"?: number,"exam_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_classes_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_classes_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_schedule": {
                  Row: {
                    "class_id": number,"created_at": string,"ends_at": string,"exam_date": string,"exam_id": number,"id": number,"starts_at": string,"subject_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": number,"created_at"?: string,"ends_at": string,"exam_date": string,"exam_id": number,"id"?: never,"starts_at": string,"subject_id": number,"updated_at"?: string
                  }
                  Update: {
                    "class_id"?: number,"created_at"?: string,"ends_at"?: string,"exam_date"?: string,"exam_id"?: number,"id"?: never,"starts_at"?: string,"subject_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_schedule_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_schedule_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_schedule_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"exam_subjects": {
                  Row: {
                    "class_id": number,"counts_in_gpa": boolean,"cq_full": number,"cq_pass": number | null,"created_at": string,"exam_id": number,"full_marks": number | null,"id": number,"locked": boolean,"mcq_full": number,"mcq_pass": number | null,"practical_full": number,"practical_pass": number | null,"subject_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": number,"counts_in_gpa"?: boolean,"cq_full"?: number,"cq_pass"?: number | null,"created_at"?: string,"exam_id": number,"full_marks"?: never,"id"?: never,"locked"?: boolean,"mcq_full"?: number,"mcq_pass"?: number | null,"practical_full"?: number,"practical_pass"?: number | null,"subject_id": number,"updated_at"?: string
                  }
                  Update: {
                    "class_id"?: number,"counts_in_gpa"?: boolean,"cq_full"?: number,"cq_pass"?: number | null,"created_at"?: string,"exam_id"?: number,"full_marks"?: never,"id"?: never,"locked"?: boolean,"mcq_full"?: number,"mcq_pass"?: number | null,"practical_full"?: number,"practical_pass"?: number | null,"subject_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exam_subjects_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_subjects_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "exam_subjects_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"exams": {
                  Row: {
                    "created_at": string,"ends_on": string | null,"id": number,"inputs_changed_at": string | null,"name_bn": string,"name_en": string,"published_at": string | null,"results_processed_at": string | null,"schedule_published": boolean,"session_id": number,"starts_on": string | null,"status": Database["public"]['Enums']["exam_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on"?: string | null,"id"?: never,"inputs_changed_at"?: string | null,"name_bn"?: string,"name_en": string,"published_at"?: string | null,"results_processed_at"?: string | null,"schedule_published"?: boolean,"session_id": number,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["exam_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string | null,"id"?: never,"inputs_changed_at"?: string | null,"name_bn"?: string,"name_en"?: string,"published_at"?: string | null,"results_processed_at"?: string | null,"schedule_published"?: boolean,"session_id"?: number,"starts_on"?: string | null,"status"?: Database["public"]['Enums']["exam_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exams_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_heads": {
                  Row: {
                    "code": string,"created_at": string,"frequency": Database["public"]['Enums']["fee_frequency"],"id": number,"name_bn": string,"name_en": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"frequency": Database["public"]['Enums']["fee_frequency"],"id"?: never,"name_bn"?: string,"name_en": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"frequency"?: Database["public"]['Enums']["fee_frequency"],"id"?: never,"name_bn"?: string,"name_en"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fee_settings": {
                  Row: {
                    "due_days": number,"grace_days": number,"id": number,"late_fine_cap": number,"late_fine_per_day": number,"online_payment_enabled": boolean,"payment_provider": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "due_days"?: number,"grace_days"?: number,"id"?: number,"late_fine_cap"?: number,"late_fine_per_day"?: number,"online_payment_enabled"?: boolean,"payment_provider"?: string,"updated_at"?: string
                  }
                  Update: {
                    "due_days"?: number,"grace_days"?: number,"id"?: number,"late_fine_cap"?: number,"late_fine_per_day"?: number,"online_payment_enabled"?: boolean,"payment_provider"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"fee_structures": {
                  Row: {
                    "amount": number,"class_id": number,"created_at": string,"fee_head_id": number,"group_id": number | null,"id": number,"session_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"class_id": number,"created_at"?: string,"fee_head_id": number,"group_id"?: number | null,"id"?: never,"session_id": number,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"class_id"?: number,"created_at"?: string,"fee_head_id"?: number,"group_id"?: number | null,"id"?: never,"session_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_structures_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_fee_head_id_fkey"
      columns: ["fee_head_id"]
isOneToOne: false
      referencedRelation: "fee_heads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_structures_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"fee_waivers": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"fee_head_id": number,"id": number,"kind": Database["public"]['Enums']["waiver_kind"],"reason": string,"session_id": number,"student_id": number,"updated_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"fee_head_id": number,"id"?: never,"kind": Database["public"]['Enums']["waiver_kind"],"reason": string,"session_id": number,"student_id": number,"updated_at"?: string,"value": number
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"fee_head_id"?: number,"id"?: never,"kind"?: Database["public"]['Enums']["waiver_kind"],"reason"?: string,"session_id"?: number,"student_id"?: number,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "fee_waivers_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_waivers_fee_head_id_fkey"
      columns: ["fee_head_id"]
isOneToOne: false
      referencedRelation: "fee_heads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_waivers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fee_waivers_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"gallery_albums": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"event_date": string | null,"id": number,"is_published": boolean,"published_at": string | null,"slug": string,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"event_date"?: string | null,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"slug": string,"title_bn"?: string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"event_date"?: string | null,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"slug"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gallery_images": {
                  Row: {
                    "album_id": number,"caption_bn": string,"caption_en": string,"created_at": string,"id": number,"image_path": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "album_id": number,"caption_bn"?: string,"caption_en"?: string,"created_at"?: string,"id"?: never,"image_path": string,"sort_order"?: number
                  }
                  Update: {
                    "album_id"?: number,"caption_bn"?: string,"caption_en"?: string,"created_at"?: string,"id"?: never,"image_path"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "gallery_images_album_id_fkey"
      columns: ["album_id"]
isOneToOne: false
      referencedRelation: "gallery_albums"
      referencedColumns: ["id"]
    }
                  ]
                },"governing_body": {
                  Row: {
                    "created_at": string,"full_name_bn": string,"full_name_en": string,"id": number,"photo_path": string | null,"position_bn": string,"position_en": string,"sort_order": number,"term_end": string | null,"term_start": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name_bn"?: string,"full_name_en": string,"id"?: never,"photo_path"?: string | null,"position_bn"?: string,"position_en": string,"sort_order"?: number,"term_end"?: string | null,"term_start": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name_bn"?: string,"full_name_en"?: string,"id"?: never,"photo_path"?: string | null,"position_bn"?: string,"position_en"?: string,"sort_order"?: number,"term_end"?: string | null,"term_start"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"groups": {
                  Row: {
                    "code": string,"created_at": string,"id": number,"name_bn": string,"name_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: never,"name_bn"?: string,"name_en": string,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: never,"name_bn"?: string,"name_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"guardians": {
                  Row: {
                    "address": string | null,"created_at": string,"email": string | null,"full_name_bn": string,"full_name_en": string,"id": number,"nid": string | null,"occupation": string,"phone": string,"profile_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"full_name_bn"?: string,"full_name_en": string,"id"?: never,"nid"?: string | null,"occupation"?: string,"phone": string,"profile_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"email"?: string | null,"full_name_bn"?: string,"full_name_en"?: string,"id"?: never,"nid"?: string | null,"occupation"?: string,"phone"?: string,"profile_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardians_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": number,"starts_on": string,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: never,"starts_on": string,"title_bn"?: string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: never,"starts_on"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invoice_counters": {
                  Row: {
                    "last_no": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_no": number,"year": number
                  }
                  Update: {
                    "last_no"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"invoice_items": {
                  Row: {
                    "created_at": string,"fee_head_id": number,"gross": number,"id": number,"invoice_id": number,"is_fine": boolean,"net": number | null,"period_key": string,"student_id": number,"waiver": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fee_head_id": number,"gross": number,"id"?: never,"invoice_id": number,"is_fine"?: boolean,"net"?: never,"period_key": string,"student_id": number,"waiver"?: number
                  }
                  Update: {
                    "created_at"?: string,"fee_head_id"?: number,"gross"?: number,"id"?: never,"invoice_id"?: number,"is_fine"?: boolean,"net"?: never,"period_key"?: string,"student_id"?: number,"waiver"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_fee_head_id_fkey"
      columns: ["fee_head_id"]
isOneToOne: false
      referencedRelation: "fee_heads"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"invoices": {
                  Row: {
                    "created_at": string,"created_by": string | null,"due_on": string,"id": number,"invoice_no": string,"issued_on": string,"paid": number,"session_id": number,"status": Database["public"]['Enums']["invoice_status"],"student_id": number,"total": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"due_on": string,"id"?: never,"invoice_no": string,"issued_on"?: string,"paid"?: number,"session_id": number,"status"?: Database["public"]['Enums']["invoice_status"],"student_id": number,"total"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"due_on"?: string,"id"?: never,"invoice_no"?: string,"issued_on"?: string,"paid"?: number,"session_id"?: number,"status"?: Database["public"]['Enums']["invoice_status"],"student_id"?: number,"total"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invoices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoices_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"mark_locks": {
                  Row: {
                    "exam_subject_id": number,"locked_at": string,"locked_by": string | null,"section_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "exam_subject_id": number,"locked_at"?: string,"locked_by"?: string | null,"section_id": number
                  }
                  Update: {
                    "exam_subject_id"?: number,"locked_at"?: string,"locked_by"?: string | null,"section_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mark_locks_exam_subject_id_fkey"
      columns: ["exam_subject_id"]
isOneToOne: false
      referencedRelation: "exam_subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_locks_locked_by_fkey"
      columns: ["locked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mark_locks_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    }
                  ]
                },"marks": {
                  Row: {
                    "cq": number | null,"created_at": string,"entered_by": string | null,"exam_subject_id": number,"id": number,"is_absent": boolean,"mcq": number | null,"practical": number | null,"student_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cq"?: number | null,"created_at"?: string,"entered_by"?: string | null,"exam_subject_id": number,"id"?: never,"is_absent"?: boolean,"mcq"?: number | null,"practical"?: number | null,"student_id": number,"updated_at"?: string
                  }
                  Update: {
                    "cq"?: number | null,"created_at"?: string,"entered_by"?: string | null,"exam_subject_id"?: number,"id"?: never,"is_absent"?: boolean,"mcq"?: number | null,"practical"?: number | null,"student_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "marks_entered_by_fkey"
      columns: ["entered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marks_exam_subject_id_fkey"
      columns: ["exam_subject_id"]
isOneToOne: false
      referencedRelation: "exam_subjects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "marks_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "created_at": string,"id": number,"is_hidden": boolean,"label_bn": string,"label_en": string,"page_id": number | null,"parent_id": number | null,"sort_order": number,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"is_hidden"?: boolean,"label_bn"?: string,"label_en": string,"page_id"?: number | null,"parent_id"?: number | null,"sort_order"?: number,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"is_hidden"?: boolean,"label_bn"?: string,"label_en"?: string,"page_id"?: number | null,"parent_id"?: number | null,"sort_order"?: number,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_items_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"news": {
                  Row: {
                    "body_bn": string,"body_en": string,"cover_path": string | null,"created_at": string,"created_by": string | null,"id": number,"is_published": boolean,"published_at": string | null,"slug": string,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_bn"?: string,"body_en"?: string,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"slug": string,"title_bn"?: string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "body_bn"?: string,"body_en"?: string,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"slug"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "news_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notices": {
                  Row: {
                    "attachment_path": string | null,"audience": Database["public"]['Enums']["notice_audience"],"body_bn": string,"body_en": string,"category": Database["public"]['Enums']["notice_category"],"created_at": string,"created_by": string | null,"id": number,"is_pinned": boolean,"is_published": boolean,"published_at": string | null,"slug": string,"target_class_id": number | null,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attachment_path"?: string | null,"audience"?: Database["public"]['Enums']["notice_audience"],"body_bn"?: string,"body_en"?: string,"category"?: Database["public"]['Enums']["notice_category"],"created_at"?: string,"created_by"?: string | null,"id"?: never,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string | null,"slug": string,"target_class_id"?: number | null,"title_bn"?: string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "attachment_path"?: string | null,"audience"?: Database["public"]['Enums']["notice_audience"],"body_bn"?: string,"body_en"?: string,"category"?: Database["public"]['Enums']["notice_category"],"created_at"?: string,"created_by"?: string | null,"id"?: never,"is_pinned"?: boolean,"is_published"?: boolean,"published_at"?: string | null,"slug"?: string,"target_class_id"?: number | null,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notices_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notices_target_class_id_fkey"
      columns: ["target_class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    }
                  ]
                },"page_attachments": {
                  Row: {
                    "created_at": string,"file_path": string,"file_size": number,"id": number,"label_bn": string,"label_en": string,"mime_type": string,"page_id": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_path": string,"file_size": number,"id"?: never,"label_bn"?: string,"label_en": string,"mime_type": string,"page_id": number,"sort_order"?: number
                  }
                  Update: {
                    "created_at"?: string,"file_path"?: string,"file_size"?: number,"id"?: never,"label_bn"?: string,"label_en"?: string,"mime_type"?: string,"page_id"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "page_attachments_page_id_fkey"
      columns: ["page_id"]
isOneToOne: false
      referencedRelation: "pages"
      referencedColumns: ["id"]
    }
                  ]
                },"pages": {
                  Row: {
                    "body_bn": string,"body_en": string,"cover_path": string | null,"created_at": string,"created_by": string | null,"has_content": boolean | null,"id": number,"is_published": boolean,"published_at": string | null,"seo_description_bn": string,"seo_description_en": string,"seo_title_bn": string,"seo_title_en": string,"slug": string,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_bn"?: string,"body_en"?: string,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"has_content"?: never,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"seo_description_bn"?: string,"seo_description_en"?: string,"seo_title_bn"?: string,"seo_title_en"?: string,"slug": string,"title_bn"?: string,"title_en": string,"updated_at"?: string
                  }
                  Update: {
                    "body_bn"?: string,"body_en"?: string,"cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"has_content"?: never,"id"?: never,"is_published"?: boolean,"published_at"?: string | null,"seo_description_bn"?: string,"seo_description_en"?: string,"seo_title_bn"?: string,"seo_title_en"?: string,"slug"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pages_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_allocations": {
                  Row: {
                    "amount": number,"id": number,"invoice_item_id": number,"payment_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"id"?: never,"invoice_item_id": number,"payment_id": number
                  }
                  Update: {
                    "amount"?: number,"id"?: never,"invoice_item_id"?: number,"payment_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_allocations_invoice_item_id_fkey"
      columns: ["invoice_item_id"]
isOneToOne: false
      referencedRelation: "invoice_item_balances"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_invoice_item_id_fkey"
      columns: ["invoice_item_id"]
isOneToOne: false
      referencedRelation: "invoice_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_allocations_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_intents": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"failure_reason": string | null,"id": string,"item_ids": (number)[],"payment_id": number | null,"provider": string,"provider_txn_id": string | null,"status": string,"student_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"failure_reason"?: string | null,"id"?: string,"item_ids": (number)[],"payment_id"?: number | null,"provider": string,"provider_txn_id"?: string | null,"status"?: string,"student_id": number,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"failure_reason"?: string | null,"id"?: string,"item_ids"?: (number)[],"payment_id"?: number | null,"provider"?: string,"provider_txn_id"?: string | null,"status"?: string,"student_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_intents_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_intents_payment_id_fkey"
      columns: ["payment_id"]
isOneToOne: true
      referencedRelation: "payments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payment_intents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"cancel_reason": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"collected_by": string | null,"collected_by_name": string,"created_at": string,"id": number,"method": Database["public"]['Enums']["payment_method"],"note": string,"paid_on": string,"receipt_no": string,"student_id": number,"txn_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"collected_by"?: string | null,"collected_by_name"?: string,"created_at"?: string,"id"?: never,"method": Database["public"]['Enums']["payment_method"],"note"?: string,"paid_on": string,"receipt_no": string,"student_id": number,"txn_id"?: string | null
                  }
                  Update: {
                    "amount"?: number,"cancel_reason"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"collected_by"?: string | null,"collected_by_name"?: string,"created_at"?: string,"id"?: never,"method"?: Database["public"]['Enums']["payment_method"],"note"?: string,"paid_on"?: string,"receipt_no"?: string,"student_id"?: number,"txn_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_collected_by_fkey"
      columns: ["collected_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"periods": {
                  Row: {
                    "created_at": string,"ends_at": string,"id": number,"is_break": boolean,"number": number,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_at": string,"id"?: never,"is_break"?: boolean,"number": number,"starts_at": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string,"id"?: never,"is_break"?: boolean,"number"?: number,"starts_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"email": string | null,"full_name_bn": string,"full_name_en": string,"id": string,"is_active": boolean,"must_change_password": boolean,"phone": string | null,"role": Database["public"]['Enums']["app_role"] | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name_bn"?: string,"full_name_en"?: string,"id": string,"is_active"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"email"?: string | null,"full_name_bn"?: string,"full_name_en"?: string,"id"?: string,"is_active"?: boolean,"must_change_password"?: boolean,"phone"?: string | null,"role"?: Database["public"]['Enums']["app_role"] | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"receipt_counters": {
                  Row: {
                    "last_no": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_no": number,"year": number
                  }
                  Update: {
                    "last_no"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                },"results": {
                  Row: {
                    "attendance_percent": number | null,"class_position": number,"created_at": string,"exam_id": number,"failed_count": number,"full_total": number,"gpa": number,"gpa_without_fourth": number,"grade": string,"group_id": number | null,"id": number,"passed": boolean,"roll": number,"section_id": number,"section_position": number,"student_id": number,"subjects": NonNullable<Json>,"total": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_percent"?: number | null,"class_position": number,"created_at"?: string,"exam_id": number,"failed_count"?: number,"full_total": number,"gpa": number,"gpa_without_fourth": number,"grade": string,"group_id"?: number | null,"id"?: never,"passed": boolean,"roll": number,"section_id": number,"section_position": number,"student_id": number,"subjects": NonNullable<Json>,"total": number
                  }
                  Update: {
                    "attendance_percent"?: number | null,"class_position"?: number,"created_at"?: string,"exam_id"?: number,"failed_count"?: number,"full_total"?: number,"gpa"?: number,"gpa_without_fourth"?: number,"grade"?: string,"group_id"?: number | null,"id"?: never,"passed"?: boolean,"roll"?: number,"section_id"?: number,"section_position"?: number,"student_id"?: number,"subjects"?: NonNullable<Json>,"total"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "results_exam_id_fkey"
      columns: ["exam_id"]
isOneToOne: false
      referencedRelation: "exams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "results_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "created_at": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"routine": {
                  Row: {
                    "created_at": string,"day_of_week": number,"id": number,"period_id": number,"room_id": number | null,"section_id": number,"session_id": number,"staff_id": number | null,"subject_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_of_week": number,"id"?: never,"period_id": number,"room_id"?: number | null,"section_id": number,"session_id": number,"staff_id"?: number | null,"subject_id": number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"day_of_week"?: number,"id"?: never,"period_id"?: number,"room_id"?: number | null,"section_id"?: number,"session_id"?: number,"staff_id"?: number | null,"subject_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "routine_period_id_fkey"
      columns: ["period_id"]
isOneToOne: false
      referencedRelation: "periods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "public_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "routine_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"school_settings": {
                  Row: {
                    "address_bn": string,"address_en": string,"center_code": string,"created_at": string,"eiin": string,"email": string,"established_year": number | null,"facebook_url": string,"favicon_path": string | null,"grading": NonNullable<Json>,"head_message_bn": string,"head_message_en": string,"head_name_bn": string,"head_name_en": string,"head_photo_path": string | null,"id": number,"institution_code": string,"logo_path": string | null,"map_embed_url": string,"name_bn": string,"name_en": string,"office_hours_bn": string,"office_hours_en": string,"phone": string,"primary_color": string,"secondary_color": string,"short_name": string,"updated_at": string,"website_url": string,"working_days": (number)[],"youtube_url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address_bn"?: string,"address_en"?: string,"center_code"?: string,"created_at"?: string,"eiin"?: string,"email"?: string,"established_year"?: number | null,"facebook_url"?: string,"favicon_path"?: string | null,"grading"?: NonNullable<Json>,"head_message_bn"?: string,"head_message_en"?: string,"head_name_bn"?: string,"head_name_en"?: string,"head_photo_path"?: string | null,"id"?: number,"institution_code"?: string,"logo_path"?: string | null,"map_embed_url"?: string,"name_bn"?: string,"name_en": string,"office_hours_bn"?: string,"office_hours_en"?: string,"phone"?: string,"primary_color"?: string,"secondary_color"?: string,"short_name"?: string,"updated_at"?: string,"website_url"?: string,"working_days"?: (number)[],"youtube_url"?: string
                  }
                  Update: {
                    "address_bn"?: string,"address_en"?: string,"center_code"?: string,"created_at"?: string,"eiin"?: string,"email"?: string,"established_year"?: number | null,"facebook_url"?: string,"favicon_path"?: string | null,"grading"?: NonNullable<Json>,"head_message_bn"?: string,"head_message_en"?: string,"head_name_bn"?: string,"head_name_en"?: string,"head_photo_path"?: string | null,"id"?: number,"institution_code"?: string,"logo_path"?: string | null,"map_embed_url"?: string,"name_bn"?: string,"name_en"?: string,"office_hours_bn"?: string,"office_hours_en"?: string,"phone"?: string,"primary_color"?: string,"secondary_color"?: string,"short_name"?: string,"updated_at"?: string,"website_url"?: string,"working_days"?: (number)[],"youtube_url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sections": {
                  Row: {
                    "capacity": number | null,"class_id": number,"class_teacher_id": number | null,"created_at": string,"id": number,"name_bn": string,"name_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capacity"?: number | null,"class_id": number,"class_teacher_id"?: number | null,"created_at"?: string,"id"?: never,"name_bn"?: string,"name_en": string,"updated_at"?: string
                  }
                  Update: {
                    "capacity"?: number | null,"class_id"?: number,"class_teacher_id"?: number | null,"created_at"?: string,"id"?: never,"name_bn"?: string,"name_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sections_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sections_class_teacher_id_fkey"
      columns: ["class_teacher_id"]
isOneToOne: false
      referencedRelation: "public_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sections_class_teacher_id_fkey"
      columns: ["class_teacher_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"site_links": {
                  Row: {
                    "created_at": string,"icon": string,"id": number,"is_published": boolean,"label_bn": string,"label_en": string,"placement": Database["public"]['Enums']["link_placement"],"sort_order": number,"updated_at": string,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"icon"?: string,"id"?: never,"is_published"?: boolean,"label_bn"?: string,"label_en": string,"placement": Database["public"]['Enums']["link_placement"],"sort_order"?: number,"updated_at"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"icon"?: string,"id"?: never,"is_published"?: boolean,"label_bn"?: string,"label_en"?: string,"placement"?: Database["public"]['Enums']["link_placement"],"sort_order"?: number,"updated_at"?: string,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sliders": {
                  Row: {
                    "created_at": string,"id": number,"image_path": string,"is_published": boolean,"link_url": string | null,"published_at": string | null,"sort_order": number,"subtitle_bn": string,"subtitle_en": string,"title_bn": string,"title_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"image_path": string,"is_published"?: boolean,"link_url"?: string | null,"published_at"?: string | null,"sort_order"?: number,"subtitle_bn"?: string,"subtitle_en"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"image_path"?: string,"is_published"?: boolean,"link_url"?: string | null,"published_at"?: string | null,"sort_order"?: number,"subtitle_bn"?: string,"subtitle_en"?: string,"title_bn"?: string,"title_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff": {
                  Row: {
                    "bio_bn": string,"bio_en": string,"created_at": string,"designation_id": number,"full_name_bn": string,"full_name_en": string,"id": number,"is_public": boolean,"joined_on": string | null,"left_on": string | null,"photo_path": string | null,"profile_id": string | null,"qualification_bn": string,"qualification_en": string,"sort_order": number,"subject_bn": string,"subject_en": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio_bn"?: string,"bio_en"?: string,"created_at"?: string,"designation_id": number,"full_name_bn"?: string,"full_name_en": string,"id"?: never,"is_public"?: boolean,"joined_on"?: string | null,"left_on"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"qualification_bn"?: string,"qualification_en"?: string,"sort_order"?: number,"subject_bn"?: string,"subject_en"?: string,"updated_at"?: string
                  }
                  Update: {
                    "bio_bn"?: string,"bio_en"?: string,"created_at"?: string,"designation_id"?: number,"full_name_bn"?: string,"full_name_en"?: string,"id"?: never,"is_public"?: boolean,"joined_on"?: string | null,"left_on"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"qualification_bn"?: string,"qualification_en"?: string,"sort_order"?: number,"subject_bn"?: string,"subject_en"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_designation_id_fkey"
      columns: ["designation_id"]
isOneToOne: false
      referencedRelation: "designations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_private": {
                  Row: {
                    "address": string | null,"birth_date": string | null,"created_at": string,"email": string | null,"nid": string | null,"personal_phone": string | null,"staff_id": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"birth_date"?: string | null,"created_at"?: string,"email"?: string | null,"nid"?: string | null,"personal_phone"?: string | null,"staff_id": number,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"birth_date"?: string | null,"created_at"?: string,"email"?: string | null,"nid"?: string | null,"personal_phone"?: string | null,"staff_id"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_private_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: true
      referencedRelation: "public_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_private_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: true
      referencedRelation: "staff"
      referencedColumns: ["id"]
    }
                  ]
                },"student_code_counters": {
                  Row: {
                    "last_value": number,"prefix": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_value": number,"prefix": string
                  }
                  Update: {
                    "last_value"?: number,"prefix"?: string
                  }
                  Relationships: [
                    
                  ]
                },"student_documents": {
                  Row: {
                    "created_at": string,"file_path": string,"file_size": number,"id": number,"label": string,"mime_type": string,"student_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_path": string,"file_size": number,"id"?: never,"label": string,"mime_type": string,"student_id": number
                  }
                  Update: {
                    "created_at"?: string,"file_path"?: string,"file_size"?: number,"id"?: never,"label"?: string,"mime_type"?: string,"student_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_documents_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"student_guardians": {
                  Row: {
                    "created_at": string,"guardian_id": number,"is_primary": boolean,"relation": string,"student_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"guardian_id": number,"is_primary"?: boolean,"relation": string,"student_id": number
                  }
                  Update: {
                    "created_at"?: string,"guardian_id"?: number,"is_primary"?: boolean,"relation"?: string,"student_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "student_guardians_guardian_id_fkey"
      columns: ["guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "student_guardians_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"students": {
                  Row: {
                    "address": string | null,"admitted_on": string | null,"birth_date": string | null,"birth_reg_no": string | null,"blood_group": Database["public"]['Enums']["blood_group"] | null,"created_at": string,"full_name_bn": string,"full_name_en": string,"gender": Database["public"]['Enums']["gender"],"id": number,"personal_phone": string | null,"photo_path": string | null,"profile_id": string | null,"religion": Database["public"]['Enums']["religion"] | null,"status": Database["public"]['Enums']["student_status"],"student_code": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"admitted_on"?: string | null,"birth_date"?: string | null,"birth_reg_no"?: string | null,"blood_group"?: Database["public"]['Enums']["blood_group"] | null,"created_at"?: string,"full_name_bn"?: string,"full_name_en": string,"gender": Database["public"]['Enums']["gender"],"id"?: never,"personal_phone"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"religion"?: Database["public"]['Enums']["religion"] | null,"status"?: Database["public"]['Enums']["student_status"],"student_code": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"admitted_on"?: string | null,"birth_date"?: string | null,"birth_reg_no"?: string | null,"blood_group"?: Database["public"]['Enums']["blood_group"] | null,"created_at"?: string,"full_name_bn"?: string,"full_name_en"?: string,"gender"?: Database["public"]['Enums']["gender"],"id"?: never,"personal_phone"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"religion"?: Database["public"]['Enums']["religion"] | null,"status"?: Database["public"]['Enums']["student_status"],"student_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "students_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"subjects": {
                  Row: {
                    "code": string,"created_at": string,"id": number,"name_bn": string,"name_en": string,"paper_group": string | null,"sort_order": number,"type": Database["public"]['Enums']["subject_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: never,"name_bn"?: string,"name_en": string,"paper_group"?: string | null,"sort_order"?: number,"type"?: Database["public"]['Enums']["subject_type"],"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: never,"name_bn"?: string,"name_en"?: string,"paper_group"?: string | null,"sort_order"?: number,"type"?: Database["public"]['Enums']["subject_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"teacher_assignments": {
                  Row: {
                    "created_at": string,"id": number,"section_id": number,"session_id": number,"staff_id": number,"subject_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"section_id": number,"session_id": number,"staff_id": number,"subject_id": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"section_id"?: number,"session_id"?: number,"staff_id"?: number,"subject_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "teacher_assignments_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "academic_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "public_staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teacher_assignments_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "subjects"
      referencedColumns: ["id"]
    }
                  ]
                },"tracking_counters": {
                  Row: {
                    "last_value": number,"year": number
                  }
                  ComputedFields: never
                  Insert: {
                    "last_value"?: number,"year": number
                  }
                  Update: {
                    "last_value"?: number,"year"?: number
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "invoice_item_balances": {
                  Row: {
                    "id": number,"invoice_id": number,"net": number | null,"outstanding": number | null,"paid": number | null,"student_id": number
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "invoice_items_invoice_id_fkey"
      columns: ["invoice_id"]
isOneToOne: false
      referencedRelation: "invoices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invoice_items_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "students"
      referencedColumns: ["id"]
    }
                  ]
                },"public_staff": {
                  Row: {
                    "bio_bn": string,"bio_en": string,"designation_bn": string,"designation_en": string,"designation_rank": number,"full_name_bn": string,"full_name_en": string,"id": number,"is_current": boolean | null,"joining_year": number | null,"photo_path": string | null,"qualification_bn": string,"qualification_en": string,"sort_order": number,"subject_bn": string,"subject_en": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "add_student":
{ Args: { "p_group_id": number,"p_roll": number,"p_section_id": number,"p_session_id": number,"p_student": Json }; Returns: {
              "roll": number,"student_code": string,"student_id": number
            }[]
                           },
"approve_admission":
{ Args: { "p_application_id": number,"p_section_id": number }; Returns: {
              "guardian_id": number,"roll": number,"student_code": string,"student_id": number
            }[]
                           },
"attendance_counts":
{ Args: { "p_from": string,"p_section_ids": (number)[],"p_to": string }; Returns: {
              "absent": number,"late": number,"on_leave": number,"present": number,"student_id": number
            }[]
                           },
"cancel_payment":
{ Args: { "p_id": number,"p_reason": string }; Returns: undefined
                           },
"class_allows_group":
{ Args: { "p_class_id": number }; Returns: boolean
                           },
"complete_payment_intent":
{ Args: { "p_amount": number,"p_id": string,"p_provider": string,"p_txn": string }; Returns: string
                           },
"copy_fee_structure":
{ Args: { "p_from": number,"p_to": number }; Returns: number
                           },
"create_invoices":
{ Args: { "p_due_on": string,"p_period_key": string,"p_rows": Json,"p_session_id": number }; Returns: Json
                           },
"create_payment_intent":
{ Args: { "p_student_id": number }; Returns: Json
                           },
"custom_access_token_hook":
{ Args: { "event": Json }; Returns: Json
                           },
"fail_payment_intent":
{ Args: { "p_id": string,"p_provider": string,"p_reason": string }; Returns: undefined
                           },
"hit_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"import_students":
{ Args: { "p_rows": Json,"p_session_id": number }; Returns: number
                           },
"is_bd_phone":
{ Args: { "value": string }; Returns: boolean
                           },
"is_rate_limited":
{ Args: { "p_key": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"issue_certificate":
{ Args: { "p_body_bn": string,"p_body_en": string,"p_reference": string,"p_student_id": number,"p_type": string }; Returns: number
                           },
"lookup_result":
{ Args: { "p_exam_id": number,"p_group_id"?: number,"p_roll": number,"p_section_id": number }; Returns: Json
                           },
"next_tracking_no":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"promote_students":
{ Args: { "p_class_id": number,"p_decisions": Json,"p_from_session": number,"p_to_session": number }; Returns: number
                           },
"public_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"record_audit":
{ Args: { "p_action": string,"p_details": Json,"p_entity": string,"p_entity_id": string }; Returns: undefined
                           },
"record_payment":
{ Args: { "p_amount": number,"p_item_ids": (number)[],"p_method": Database["public"]['Enums']["payment_method"],"p_note": string,"p_student_id": number,"p_txn_id": string }; Returns: Json
                           },
"revoke_certificate":
{ Args: { "p_id": number,"p_reason": string }; Returns: boolean
                           },
"save_exam_results":
{ Args: { "p_as_of"?: string,"p_exam_id": number,"p_rows": Json }; Returns: number
                           },
"save_section_routine":
{ Args: { "p_cells": Json,"p_section_id": number,"p_session_id": number }; Returns: number
                           },
"set_current_session":
{ Args: { "p_session_id": number }; Returns: boolean
                           },
"set_primary_guardian":
{ Args: { "p_guardian_id": number,"p_student_id": number }; Returns: boolean
                           },
"submit_marks":
{ Args: { "p_exam_subject_id": number,"p_section_id": number }; Returns: number
                           },
"unlock_marks":
{ Args: { "p_exam_subject_id": number,"p_section_id": number }; Returns: boolean
                           },
"verify_certificate":
{ Args: { "p_reference": string }; Returns: Json
                           }
          }
          Enums: {
            "admission_status": "submitted"|"under_review"|"test_scheduled"|"approved"|"rejected"|"waitlisted","app_role": "super_admin"|"admin"|"teacher"|"accountant"|"student"|"guardian","attendance_status": "present"|"absent"|"late"|"leave","blood_group": "A+"|"A-"|"B+"|"B-"|"AB+"|"AB-"|"O+"|"O-","exam_status": "draft"|"marks_entry"|"review"|"published","fee_frequency": "monthly"|"one_time","gender": "male"|"female"|"other","invoice_status": "unpaid"|"partial"|"paid"|"cancelled","link_placement": "quick"|"footer","notice_audience": "public"|"staff"|"class","notice_category": "general"|"exam"|"result"|"admission"|"holiday","payment_method": "cash"|"bkash"|"nagad"|"rocket"|"bank"|"online","religion": "islam"|"hinduism"|"buddhism"|"christianity"|"other","student_status": "active"|"inactive"|"transferred"|"graduated","subject_type": "compulsory"|"optional"|"fourth","waiver_kind": "percent"|"fixed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "admission_status": ["submitted", "under_review", "test_scheduled", "approved", "rejected", "waitlisted"],"app_role": ["super_admin", "admin", "teacher", "accountant", "student", "guardian"],"attendance_status": ["present", "absent", "late", "leave"],"blood_group": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],"exam_status": ["draft", "marks_entry", "review", "published"],"fee_frequency": ["monthly", "one_time"],"gender": ["male", "female", "other"],"invoice_status": ["unpaid", "partial", "paid", "cancelled"],"link_placement": ["quick", "footer"],"notice_audience": ["public", "staff", "class"],"notice_category": ["general", "exam", "result", "admission", "holiday"],"payment_method": ["cash", "bkash", "nagad", "rocket", "bank", "online"],"religion": ["islam", "hinduism", "buddhism", "christianity", "other"],"student_status": ["active", "inactive", "transferred", "graduated"],"subject_type": ["compulsory", "optional", "fourth"],"waiver_kind": ["percent", "fixed"]
          }
        }
} as const
