# SP: pSeleccionarContabilizacionComprasNoAutomaticas
**Tipo**: Seleccionar
**Módulo**: Compras

## Tablas Referenciadas
- [`saCuentaIngEgr`](../tables/saCuentaIngEgr.md)
- [`saDocumentoCompra`](../tables/saDocumentoCompra.md)
- [`saMoneda`](../tables/saMoneda.md)
- [`saProveedor`](../tables/saProveedor.md)
- [`saSegmento`](../tables/saSegmento.md)
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [pSeleccionarContabilizacionComprasNoAutomaticas]
     (
      @sdFechaDesde SMALLDATETIME ,
      @sdFechHasta SMALLDATETIME ,
      @sCo_Sucu_Desde CHAR(6) = NULL ,
      @sCo_Sucu_Hasta CHAR(6) = NULL ,
      @bDocnoint BIT --Documentos no Contabilizados
	
    )
AS 
    BEGIN
	/* 
	 * NOTA 1: cuando el tipo de documento utilice el auxiliar, el mismo es igual
	 * a la letra (O: Beneficiario, P: Proveedor, C: Cliente) mas el código del beneficiario,
	 * proveedor o cliente segun sea el caso. EJ: ('P' + Co_Proveedor) AS Co_Auxiliar (En el caso de que no maneje Auxiliar, se
	 * agrega el siguiente '' AS Co_Auxiliar)
	 * NOTA 1.1: Lo que valla a ser la descripcion del auxiliar se le debe poner el alias Descrip_Auxiliar
	 * NOTA 2: para los documentos que son renglon es necesario devolver el codigo del
	 * documento padre con el alias Co_Doc_Padre
	 * NOTA 3: Se debe agregar el campo dis_cen de todas las tablas con las que este relacionada la tabla actual y manejen información contable. 
	 * Se le debe poner como alias el siguiente dis_cen_NOMBRETABLA (Donde NOMBRETABLA es el nombre de la tabla a la que pertenece)
	 * EJ: dis_cen_saMovimientoBanco
	 * si la tabla tiene renglones no se agrega el dis_cen de los renglones pero en los renglones si se agrega el dis_cen del padre
	 * NOTA 4: Se debe agregar la moneda del documento (en los renglones se agrega la del padre) con el alias (en caso de que ese no sea el nombre) 'co_mone'
	 *			la descripcion de la moneda (mone_des), la tasa de cambio (tasa) y la relacion (mone_relacion)
	 * NOTA 5: IMPORTANTE, estudiar la lógica de negocios del tipo de documento y de las reglas que afectan ese tipo para incluir
	 *			los campos necesarios de alguna tabla con la que este relacionada para cumplir con esa lógica
	 * NOTA 6: Se debe agregar el codigo de la sucursal que inserto con el alias Co_Sucu_Cont
	 * NOTA 7: IMPORTANTE, todos los montos que se tomen de movimientos de caja o de banco (monto_d o monto_h) se deben convertir primero a la
	 *			moneda base ya que los movimientos de caja y banco estan registrados en la moneda que los origino
	 */
        IF @sdFechaDesde IS NOT NULL 
            SET @sdFechaDesde = dbo.FechaSimple(@sdFechaDesde)
        IF @sdFechHasta IS NOT NULL 
            SET @sdFechHasta = dbo.FechaSimple(@sdFechHasta)
SELECT     RTRIM(DV.nro_doc) AS Co_Doc, cl.co_prov AS Co_Auxiliar, cl.prov_des AS Descrip_Auxiliar, DV.nro_doc, DV.co_prov, DV.co_mone
```
