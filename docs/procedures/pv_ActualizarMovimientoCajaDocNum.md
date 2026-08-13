# SP: pv_ActualizarMovimientoCajaDocNum
**Tipo**: PV-Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: [pv_ActualizarMovimientoCajaDocNum]
*DESCRIPCIÓN	: ACTUALIZA EL CODIGO DEL NUMERO DEL DOCUMENTO DE UN MOVIMIENTO DE CAJA
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ActualizarMovimientoCajaDocNum]
    (
		@sNro_Doc		CHAR(20),
		@sNro_Cob		CHAR(20),
	    @sCo_Us_Mo		CHAR(6) ,
		@sCo_Sucu_Mo	CHAR(6)				=	NULL ,
		@sMaquina		VARCHAR(60)			=	NULL ,
		@sCampos		VARCHAR(MAX)		=	NULL ,
		@sRevisado		CHAR(1) ,
		@sTrasnfe		CHAR(1) ,
		@tsValidador	TIMESTAMP			=	NULL ,
		@gRowguid		UNIQUEIDENTIFIER	=	NULL 
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

        UPDATE saMovimientoCaja SET  doc_num = @sNro_Cob
			  OUTPUT
					inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
        WHERE
            mov_num = @sNro_Doc

		DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saMovimientoCaja', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
                    @sCampos = @sNro_Doc
            END
	END
```
