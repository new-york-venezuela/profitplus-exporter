# SP: pActualizarRenglonesGastoDistribCosto
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saDistribCostoOrigenReng`](../tables/saDistribCostoOrigenReng.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pActualizarRenglonesGastoDistribCosto
*DESCRIPCIÓN	:	Modifica un registro en la tabla  saDistribCostoOrigenReng
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/

CREATE PROCEDURE  [dbo].[pActualizarRenglonesGastoDistribCosto]
    (
		@sDistrib_Num		CHAR(20),
		@sDistrib_NumOri	CHAR(20),
		@iReng_Num			INT,
		@iRENG_NUMOri		INT,
		@gRowguid_Comp		UNIQUEIDENTIFIER	= NULL,
	    @gRowguid_PCom		UNIQUEIDENTIFIER	= NULL,
		@deMonto_Ap			DECIMAL(18,5)		= NULL,
		@sCo_us_mo			CHAR(6),
		@sCo_sucu_mo		CHAR(6),
		@sRevisado			CHAR(1)				= NULL,
		@sTrasnfe			CHAR(1)				= NULL,
		@sMaquina			VARCHAR(60)			= NULL ,
		@sCampos			VARCHAR(MAX)		= NULL ,
		@gRowguid			UNIQUEIDENTIFIER	= NULL ,
		@sCo_incoterm       CHAR(6)
	)

AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )


			UPDATE saDistribCostoOrigenReng
			   SET distrib_num = @sDistrib_Num ,reng_num = @iReng_Num ,rowguid_comp = @gRowguid_Comp,
				   rowguid_pcom =  @gRowguid_PCom, monto_ap = @deMonto_Ap, co_us_mo = @sCo_us_mo, 
				   co_sucu_mo = @sCo_sucu_mo, fe_us_mo = GETDATE(), revisado = @sRevisado, 
				   trasnfe = @sTrasnfe, rowguid = @gRowguid, co_incoterm = @sCo_incoterm
			OUTPUT
					inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
					INTO @TableTimestamp
			WHERE
					Reng_Num = @iReng_NumOri
					AND Distrib_Num = @sDistrib_NumOri

			DECLARE @dtFe_In DATETIME
			DECLARE @rowGuidOri UNIQUEIDENTIFIER

			SELECT @dtFe_In = fe_us_in, @rowGuidOri = rowguid
			FROM @TableTimestamp

				-- Insertar Pista
			EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
				@sTablaOri = 'saDistribCostoOrigenReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
				@sCampos = @sCampos
		
			SELECT
				*
			FROM
				@TableTimestamp
    END
```
