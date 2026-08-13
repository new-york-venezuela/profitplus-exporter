# SP: pActualizarPlantillaCompraReq
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pActualizarPlantillaCompraReq
*DESCRIPCIÓN	:	Actualiza una Plantilla de compra
*AUTOR			:	Softech
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarPlantillaCompraReq]
    (
      @gRowguid_Plantilla_Compra UNIQUEIDENTIFIER,
	  @sCo_Ubicacion char(6),
	  @sAutorizado char(128),
	  @sDescripcion char(512),
	  @sResponsable char(128),
	  @sEmail char(128),
	  @sEstatus char(1),
	  @dFecha DateTime,
	  @sTelefono char(128),
	  @sDireccion char(128),
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @tsValidador TIMESTAMP ,
      @sCampos VARCHAR(MAX) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
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

        UPDATE
            saPlantillaCompraReq
        SET 
			co_ubicacion = @sCo_Ubicacion, autorizado = @sAutorizado, descripcion = @sDescripcion, fecha = @dFecha,
			responsable = @sResponsable, email = @sEmail, estatus = @sEstatus, telefono = @sTelefono, direccion = @sDireccion,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_plantilla_compra = @gRowguid_Plantilla_Compra
            AND validador = @tsValidador	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_
```
