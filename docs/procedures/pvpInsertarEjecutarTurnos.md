# SP: pvpInsertarEjecutarTurnos
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvTurnoExe`](../tables/pvTurnoExe.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pvpInsertarEjecutarTurnos
*DESCRIPCIÓN	: Inserta el Inicio de un Turno para un cajero en Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pvpInsertarEjecutarTurnos]
    (
      @sNum_Turno VARCHAR(20),
      @sCo_Turno CHAR(6),
      @sCod_caja CHAR(6)  ,
	  @sCod_caja2 CHAR(6) = NULL ,
	  @sCod_caja3 CHAR(6) = NULL,
      @sUser_caj CHAR(6) ,
      @sUser_sup CHAR(6) ,
      @sdfecha_ini SMALLDATETIME ,
      @sdfecha_fin SMALLDATETIME ,
      @sStatus CHAR(2),
      @bRestringe BIT,
      @deSaldo DECIMAL(18,2) ,
	  @deSaldo2 DECIMAL(18,2) ,
	  @deSaldo3 DECIMAL(18,2) ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6),
      @sCo_us_mo CHAR (6),
      @sCo_sucu_mo CHAR (6),
      @sMaquina VARCHAR(60),
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL 

    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO pvTurnoExe
				( Num_Turno, co_turno, cod_caja,cod_caja2,cod_caja3, user_caj, user_sup, fecha_ini, fecha_fin, 
				  status, restringe, saldo,saldo2,saldo3, campo1, campo2, campo3,campo4, campo5, campo6, campo7, campo8,
                  co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sNum_Turno, @sCo_Turno, @sCod_caja,@sCod_caja2,@sCod_caja3, @sUser_caj, @sUser_sup, @sdfecha_ini, @sdfecha_fin, 
                  @sStatus, @bRestringe, @deSaldo,@deSaldo2,@deSaldo3,
				  @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,@sCampo7, @sCampo8,
			      @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_Sucu_In,
                  @sCo_Sucu_In )

        DECLARE @dtFe_In DATETIME
        DEC
```
