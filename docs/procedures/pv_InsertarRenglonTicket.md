# SP: pv_InsertarRenglonTicket
**Tipo**: PV-Insertar
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvRenglonTicket`](../tables/pvRenglonTicket.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: [pv_InsertarRenglonTicket]
*DESCRIPCIÓN	: INSERTA LA CANTIDAD DE DENOMINACIONES DE LOS TICKET O VALE DE PUNTO DE VENTA AL REALIZAR UN COBRO
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/ 

CREATE PROCEDURE [dbo].[pv_InsertarRenglonTicket]
    (
		 @sCob_num			CHAR(20),
		 @iReng_num			INT,
		 @iReng_num_vale	INT ,
		 @sCo_vale			CHAR(6),
		 @iCantidad			INT,
		 @sCampo1			VARCHAR(60) = NULL ,
		 @sCampo2			VARCHAR(60) = NULL ,
		 @sCampo3			VARCHAR(60) = NULL ,
		 @sCampo4			VARCHAR(60) = NULL ,
		 @sCampo5			VARCHAR(60) = NULL ,
		 @sCampo6			VARCHAR(60) = NULL ,
		 @sCampo7			VARCHAR(60) = NULL ,
		 @sCampo8			VARCHAR(60) = NULL ,
		 @sCo_Us_In			CHAR(6) ,
		 @sCo_Sucu_In		CHAR(6) ,
		 @sMaquina			VARCHAR(60) = NULL ,
		 @sRevisado			CHAR(1) ,
		 @sTrasnfe			CHAR(1)
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

        INSERT  INTO pvRenglonTicket
                ( cob_num, reng_num, reng_num_vale, co_vale, cantidad, 
				  campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, fe_us_in, co_us_mo, fe_us_mo, revisado, trasnfe, 
                  co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCob_num, @iReng_num, @iReng_num_vale,@sCo_vale, @iCantidad, 
				  @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Us_In, GETDATE(), @sCo_Us_In, GETDATE(),
                  @sRevisado, @sTrasnfe, @sCo_Sucu_In,
                  @sCo_Sucu_In )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'pvRenglonTicket', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCob_num
		
        SELECT
            *
        FROM
```
